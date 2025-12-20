# Makefile for GeodatExplorer

APP_NAME := gde
VERSION := 1.0.0
BUILD_DIR := out
SRC_DIR := src

.PHONY: all clean linux windows darwin dev build

all: linux-amd64 linux-arm linux-arm64 windows-amd64 darwin-amd64 darwin-arm64

clean:
	rm -rf $(BUILD_DIR)
	rm -rf $(SRC_DIR)/build/bin

# Linux builds
linux-amd64:
	cd $(SRC_DIR) && wails build -tags webkit2_41 -platform linux/amd64 -o $(APP_NAME)
	mkdir -p $(BUILD_DIR)/linux-amd64
	mv $(SRC_DIR)/build/bin/$(APP_NAME) $(BUILD_DIR)/linux-amd64/

linux-arm:
	cd $(SRC_DIR) && wails build -tags webkit2_41 -platform linux/arm -o $(APP_NAME)
	mkdir -p $(BUILD_DIR)/linux-arm
	mv $(SRC_DIR)/build/bin/$(APP_NAME) $(BUILD_DIR)/linux-arm/

linux-arm64:
	cd $(SRC_DIR) && wails build -tags webkit2_41 -platform linux/arm64 -o $(APP_NAME)
	mkdir -p $(BUILD_DIR)/linux-arm64
	mv $(SRC_DIR)/build/bin/$(APP_NAME) $(BUILD_DIR)/linux-arm64/

linux: linux-amd64 linux-arm linux-arm64

# Windows build
windows-amd64:
	cd $(SRC_DIR) && wails build -platform windows/amd64 -o $(APP_NAME).exe
	mkdir -p $(BUILD_DIR)/windows-amd64
	mv $(SRC_DIR)/build/bin/$(APP_NAME).exe $(BUILD_DIR)/windows-amd64/

windows: windows-amd64

# macOS builds
darwin-amd64:
	cd $(SRC_DIR) && wails build -platform darwin/amd64 -o $(APP_NAME)
	mkdir -p $(BUILD_DIR)/darwin-amd64
	mv $(SRC_DIR)/build/bin/$(APP_NAME) $(BUILD_DIR)/darwin-amd64/

darwin-arm64:
	cd $(SRC_DIR) && wails build -platform darwin/arm64 -o $(APP_NAME)
	mkdir -p $(BUILD_DIR)/darwin-arm64
	mv $(SRC_DIR)/build/bin/$(APP_NAME) $(BUILD_DIR)/darwin-arm64/

darwin: darwin-amd64 darwin-arm64

# Development
dev:
	cd $(SRC_DIR) && wails dev -tags webkit2_41

# Single native build
build:
	cd $(SRC_DIR) && wails build -tags webkit2_41 -o $(APP_NAME)
	mkdir -p $(BUILD_DIR)
	mv $(SRC_DIR)/build/bin/$(APP_NAME)* $(BUILD_DIR)/