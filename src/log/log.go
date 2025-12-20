package log

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"log/syslog"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sys/unix"
)

// Level is the minimum level that will be emitted.
type Level int32

const (
	LevelError Level = iota
	LevelInfo
	LevelTrace
	LevelDebug
)

var (
	CurLevel   atomic.Int32
	errFile    *os.File
	errLogger  *log.Logger
	errMu      sync.Mutex
	origStderr int
)

// multi is a simple fan-out writer (stderr + optional syslog).
type multi struct {
	mu sync.Mutex
	ws []io.Writer
}

func (m *multi) Write(p []byte) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, w := range m.ws {
		_, _ = w.Write(p)
	}
	return len(p), nil
}

var (
	mu         sync.Mutex
	base       = &multi{ws: []io.Writer{os.Stderr}}
	buf        *bufio.Writer
	logger     *log.Logger
	flushTimer *time.Ticker
	insta      bool
)

// Init sets the base writer, level, and instaflush behavior.
func Init(stderr io.Writer, level Level, instaflush bool) {

	mu.Lock()
	defer mu.Unlock()
	if stderr == nil {
		stderr = os.Stderr
	}
	base.ws = []io.Writer{stderr}
	insta = instaflush
	CurLevel.Store(int32(level))
	rebuildLocked()
}

// AttachSyslog adds an extra sink (used by tests or by EnableSyslog).
func AttachSyslog(w io.Writer) {
	if w == nil {
		return
	}
	mu.Lock()
	defer mu.Unlock()
	base.ws = append(base.ws, w)
	rebuildLocked()
}

// EnableSyslog connects to the local syslog and attaches it as a sink.
func EnableSyslog(tag string) error {
	sw, err := syslog.New(syslog.LOG_INFO|syslog.LOG_DAEMON, tag)
	if err != nil {
		return err
	}
	AttachSyslog(sw)
	return nil
}

// SetLevel changes the active level.
func SetLevel(l Level) { CurLevel.Store(int32(l)) }

// SetInstaflush toggles line buffering. Switching to instaflush flushes any
// pending buffered data immediately.
func SetInstaflush(v bool) {
	mu.Lock()
	defer mu.Unlock()
	if insta == v {
		return
	}
	insta = v
	if buf != nil && v {
		_ = buf.Flush()
	}
	rebuildLocked()
}

// Flush forces a flush when buffering is enabled.
func Flush() {
	mu.Lock()
	defer mu.Unlock()
	if buf != nil {
		_ = buf.Flush()
	}
}

func InitErrorFile(path string) error {
	if path == "" {
		return nil
	}
	errMu.Lock()
	defer errMu.Unlock()

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}
	errFile = f
	errLogger = log.New(f, "", log.Ldate|log.Ltime|log.Lmicroseconds)

	// Save original stderr fd before redirecting
	origStderr, _ = unix.Dup(int(os.Stderr.Fd()))

	// Redirect stderr to error file (captures panics)
	unix.Dup2(int(f.Fd()), int(os.Stderr.Fd()))

	return nil
}

func OrigStderr() *os.File {
	if origStderr == 0 {
		return os.Stderr
	}
	return os.NewFile(uintptr(origStderr), "stderr")
}

// ADD new function
func CloseErrorFile() {
	errMu.Lock()
	defer errMu.Unlock()
	if errFile != nil {
		_ = errFile.Sync()
		_ = errFile.Close()
		errFile = nil
		errLogger = nil
	}
}

// ---- printing ------------------------------------------------------------

func Errorf(format string, a ...any) error {
	msg := fmt.Sprintf("[ERROR] "+format, a...)
	out("%s", msg)

	errMu.Lock()
	if errLogger != nil {
		errLogger.Println(msg)
		if errFile != nil {
			_ = errFile.Sync()
		}
	}
	errMu.Unlock()

	return fmt.Errorf(format, a...)
}

func Warnf(format string, a ...any) {
	if Level(CurLevel.Load()) >= LevelError {
		out("[WARN] "+format, a...)
	}
}

func Infof(format string, a ...any) {
	if Level(CurLevel.Load()) >= LevelInfo {
		out("[INFO] "+format, a...)
	}
}

func Tracef(format string, a ...any) {
	if Level(CurLevel.Load()) >= LevelTrace {
		out("[TRACE] "+format, a...)
	}
}

func Debugf(format string, a ...any) {
	if Level(CurLevel.Load()) >= LevelDebug {
		out("[DEBUG] "+format, a...)
	}
}

func out(format string, a ...any) {
	mu.Lock()
	defer mu.Unlock()
	if logger == nil {
		rebuildLocked()
	}
	logger.Printf(format, a...)
}

// ---- internals -----------------------------------------------------------

func rebuildLocked() {
	// build sink chain
	var w io.Writer = base
	if insta {
		buf = nil
		logger = log.New(w, "", log.Ldate|log.Ltime|log.Lmicroseconds)
		stopFlusherLocked()
		return
	}

	// buffered mode
	buf = bufio.NewWriterSize(w, 16*1024)
	logger = log.New(buf, "", log.Ldate|log.Ltime|log.Lmicroseconds)
	startFlusherLocked()
}

func startFlusherLocked() {
	stopFlusherLocked()
	flushTimer = time.NewTicker(2 * time.Second)
	go func(t *time.Ticker) {
		for range t.C {
			mu.Lock()
			if buf != nil {
				_ = buf.Flush()
			}
			mu.Unlock()
		}
	}(flushTimer)
}

func stopFlusherLocked() {
	if flushTimer != nil {
		flushTimer.Stop()
		flushTimer = nil
	}
}

// Helper for mapping from your config.Verbose, if you want it.
func LevelFromVerbose(verbose int) Level {
	// Common mapping used in main.go:
	//   default -> Error, VerboseInfo -> Info, VerboseTrace -> Trace
	switch verbose {
	case 2:
		return LevelTrace
	case 1:
		return LevelInfo
	default:
		return LevelError
	}
}

// Optional convenience for non-formatted messages.
func Info(a ...any)  { Infof("%s", fmt.Sprint(a...)) }
func Trace(a ...any) { Tracef("%s", fmt.Sprint(a...)) }
func Error(a ...any) { Errorf("%s", fmt.Sprint(a...)) }
