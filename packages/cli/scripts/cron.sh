#!/bin/bash

# Run the npm script
npx tsx ../src/bin.ts cron --participant Alice --job many-txs --interval 60 --txs-count 3000
