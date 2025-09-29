#!/bin/bash

# ActorDB Build Script
# Builds ActorDB with different storage backends

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
OUTPUT_DIR="bin"
CGO_CFLAGS="-I/opt/homebrew/include"
CGO_LDFLAGS="-L/opt/homebrew/lib -lz -lbz2 -lsnappy -llz4 -lzstd"

# Function to print usage
usage() {
    echo "Usage: $0 <go|rust> [OPTIONS]"
    echo ""
    echo "Build ActorDB with different storage backends"
    echo ""
    echo "Commands:"
    echo "  go                   Build Go implementation"
    echo "  rust                 Build Rust implementation"
    echo ""
    echo "Go Build Options:"
    echo "  --all                 Build all storage backends"
    echo "  --sqlite             Build with SQLite support (default)"
    echo "  --postgresql         Build with PostgreSQL support"
    echo "  --libsql             Build with libSQL support"
    echo "  --rocksdb            Build with RocksDB support"
    echo "  --leveldb            Build with LevelDB support"
    echo "  --output-dir DIR     Output directory (default: bin/go)"
    echo "  --help               Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 go --all                    # Build all Go variants"
    echo "  $0 go --rocksdb               # Build Go with RocksDB support"
    echo "  $0 rust                       # Build Rust variant"
}

# Function to build Go with specific storage backend
build_go_storage() {
    local storage=$1
    local tags=$2
    local output_name="actordb-${storage}"
    local go_output_dir="${OUTPUT_DIR}/go"

    echo -e "${BLUE}Building Go ActorDB with ${storage} support...${NC}"
    mkdir -p "$go_output_dir"

    pushd impl/go > /dev/null
    if [ -n "$tags" ]; then
        CGO_CFLAGS="$CGO_CFLAGS" CGO_LDFLAGS="$CGO_LDFLAGS -l${storage}" go build -tags "$tags" -o "../../${go_output_dir}/${output_name}" ./cmd/actordb
    else
        go build -o "../../${go_output_dir}/${output_name}" ./cmd/actordb
    fi
    popd > /dev/null

    echo -e "${GREEN}✓ Built ${output_name}${NC}"
}

# Function to build Rust implementation
build_rust() {
    local rust_output_dir="${OUTPUT_DIR}/rust"
    echo -e "${BLUE}Building Rust ActorDB...${NC}"
    mkdir -p "$rust_output_dir"

    pushd impl/rust > /dev/null
    cargo build --release
    cp target/release/actordb "../../${rust_output_dir}/actordb"
    popd > /dev/null

    echo -e "${GREEN}✓ Built actordb (Rust)${NC}"
}


# Main script logic
if [ $# -eq 0 ]; then
    usage
    exit 1
fi

COMMAND=$1
shift

case $COMMAND in
    go)
        # Parse command line arguments for Go build
        BUILD_ALL=false
        BUILD_SQLITE=false
        BUILD_POSTGRESQL=false
        BUILD_LIBSQL=false
        BUILD_ROCKSDB=false
        BUILD_LEVELDB=false

        while [[ $# -gt 0 ]]; do
            case $1 in
                --all)
                    BUILD_ALL=true
                    shift
                    ;;
                --sqlite)
                    BUILD_SQLITE=true
                    shift
                    ;;
                --postgresql)
                    BUILD_POSTGRESQL=true
                    shift
                    ;;
                --libsql)
                    BUILD_LIBSQL=true
                    shift
                    ;;
                --rocksdb)
                    BUILD_ROCKSDB=true
                    shift
                    ;;
                --leveldb)
                    BUILD_LEVELDB=true
                    shift
                    ;;
                --output-dir)
                    OUTPUT_DIR="$2"
                    shift 2
                    ;;
                --help)
                    usage
                    exit 0
                    ;;
                *)
                    echo -e "${RED}Unknown option for 'go' command: $1${NC}"
                    usage
                    exit 1
                    ;;
            esac
        done

        # Default behavior: build SQLite if no options specified
        if ! $BUILD_ALL && ! $BUILD_SQLITE && ! $BUILD_POSTGRESQL && ! $BUILD_LIBSQL && ! $BUILD_ROCKSDB && ! $BUILD_LEVELDB; then
            BUILD_SQLITE=true
        fi

        # Create output directory
        mkdir -p "${OUTPUT_DIR}/go"

        echo -e "${YELLOW}ActorDB Go Build Script${NC}"
        echo -e "${YELLOW}======================${NC}"

        # Check if C libraries are available
        echo -e "${BLUE}Checking C library dependencies...${NC}"

        check_library() {
            local lib=$1
            if [ -f "/opt/homebrew/lib/lib${lib}.dylib" ] || [ -f "/opt/homebrew/lib/lib${lib}.a" ]; then
                echo -e "${GREEN}✓ ${lib} library found${NC}"
                return 0
            else
                echo -e "${RED}✗ ${lib} library not found${NC}"
                return 1
            fi
        }

        LIBS_MISSING=false

        if $BUILD_ALL || $BUILD_ROCKSDB; then
            if ! check_library "rocksdb"; then
                LIBS_MISSING=true
            fi
        fi

        if $BUILD_ALL || $BUILD_LEVELDB; then
            if ! check_library "leveldb"; then
                LIBS_MISSING=true
            fi
        fi

        if $LIBS_MISSING; then
            echo -e "${RED}Some C libraries are missing. Install with:${NC}"
            echo "  brew install rocksdb leveldb"
            exit 1
        fi

        echo ""

        # Build variants
        if $BUILD_ALL; then
            echo -e "${BLUE}Building all storage backends...${NC}"

            # Default (Memory + SQLite + PostgreSQL)
            build_go_storage "default" ""

            # RocksDB
            build_go_storage "rocksdb" "rocksdb"

            # LevelDB
            build_go_storage "leveldb" "leveldb"

        elif $BUILD_SQLITE; then
            build_go_storage "default" ""

        elif $BUILD_POSTGRESQL; then
            build_go_storage "postgresql" ""

        elif $BUILD_LIBSQL; then
            build_go_storage "libsql" ""

        elif $BUILD_ROCKSDB; then
            build_go_storage "rocksdb" "rocksdb"

        elif $BUILD_LEVELDB; then
            build_go_storage "leveldb" "leveldb"
        fi

        echo ""
        echo -e "${GREEN}Go build completed! Binaries are in ${OUTPUT_DIR}/go/ directory${NC}"
        echo ""
        echo -e "${YELLOW}Usage examples:${NC}"
        echo "  ./bin/go/actordb-default --config config/example.yaml"
        echo "  ./bin/go/actordb-rocksdb --config config/example.yaml"
        ;;
    rust)
        build_rust "$@"
        echo ""
        echo -e "${GREEN}Rust build completed! Binary is in ${OUTPUT_DIR}/rust/ directory${NC}"
        echo ""
        echo -e "${YELLOW}Usage example:${NC}"
        echo "  ./bin/rust/actordb --config config/example.yaml"
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        usage
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Set storage.type in config/example.yaml:"
echo "  - memory (default)"
echo "  - sqlite"
echo "  - postgresql"
echo "  - rocksdb (requires --tags rocksdb)"
echo "  - leveldb (requires --tags leveldb)"
