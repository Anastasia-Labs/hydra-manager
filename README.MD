# Hydra Manager

This project is to manage Hydra nodes both manually and automatically based on CLI

## Install packages

```bash
pnpm install # install packages using pnpm
pnpm build # build monorepo using turbo

cd packages/cli # move to cli folder to run command
```

## Cron CLI

Cron CLI is designed to run cron job on hydra instance.

This is used to stress test Hydra nodes really long time (until you manually kill process)

### How to run

```bash
npx tsx src/bin.ts cron --help # to see all options in cron job
```

```bash
npx tsx src/bin.ts cron --participant <"paricipant-name"> --job <"many-txs" | "large-utxos"> --interval <"interval-in-seconds"> --txs-count <"transactions-count"> --utxos-count ["utxos-count"] > ./cron.log 2>&1 &
```

- Participant

This can be one of participant you defined in `config.json`.

This selected participant will `initiate` Hydra Head, submit `collectCom`, `close`, `fanout` transactions.

- Job

The job can be either `many-txs` or `large-utxos`.

`many-txs`: To generate many txs in transaction chaining method.

`large-utxos`: To generate large UTxOs set.

- Interval

The interval during which the job will run.

- Txs Count

The number of transactions this job will generate every interval.

- UTxOs Count

The number of UTxOs this job will generate.

This options is only for `large-utxos` job.

This is optional, when optional it will generate as much as it can.

(Pick biggest UTxO from selected participant)

- Output Log file

You can select file to keep all the logs of background cron job process.

### Example command

```bash
npx tsx src/bin.ts cron --participant Alice --job many-txs --interval 60 --txs-count 2000 > ./cron.log 2>&1 &
```
