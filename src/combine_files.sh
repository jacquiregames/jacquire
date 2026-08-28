#!/bin/bash

# Temporary combined file
OUTPUT_FILE="combined_output.txt"

# Final chunk prefix
CHUNK_PREFIX="jacquire"

# Clear existing temp output file
> "$OUTPUT_FILE"

echo "Starting file combination..."
echo "Output will be saved to multiple chunks: ${CHUNK_PREFIX}1.txt, ${CHUNK_PREFIX}2.txt, ..."

# Combine all files recursively
find . -type f -exec sh -c '
    OUTPUT_FILE_PATH="./combined_output.txt"

    # Skip this script and previous output parts
    case "$(basename "$1")" in
        combine_files.sh|combined_output.txt|jacquire*.txt)
            echo "Skipping excluded file: $1"
            return
            ;;
    esac

    echo "--- File: $1 ---" >> "$OUTPUT_FILE_PATH"
    cat "$1" >> "$OUTPUT_FILE_PATH"
    echo "" >> "$OUTPUT_FILE_PATH"
' _ {} \;

echo "---"
echo "Combination complete. Now splitting into 50KB chunks..."

# Remove old chunks if they exist
rm -f ${CHUNK_PREFIX}*.txt

# Split into chunks of approx 50KB
# -b 50k  => size
# -d      => numeric suffixes
# --additional-suffix=.txt  => append .txt extension
split -b 50k -d "$OUTPUT_FILE" "${CHUNK_PREFIX}" --additional-suffix=".txt"

echo "Chunking complete:"
ls -lh ${CHUNK_PREFIX}*.txt

echo "---"
echo "Total lines in temporary output file:"
wc -l "$OUTPUT_FILE"
