import { Blockfrost, Koios, OutRef, Provider } from "@lucid-evolution/lucid";
import { Effect, Layer } from "effect";
import * as ProjectConfig from "./ProjectConfig.js";

export class ProviderEffect extends Effect.Service<ProviderEffect>()(
  "ProviderEffect",
  {
    effect: Effect.gen(function* () {
      const config = yield* ProjectConfig.ProjectConfig;
      const provider: Provider =
        ("blockfrostProjectId" in config.providerId)
          ? new Blockfrost(
              `https://cardano-${config.network.toLocaleLowerCase()}.blockfrost.io/api/v0`,
              config.providerId.blockfrostProjectId,
            )
          : new Koios(
              `https://${config.network.toLocaleLowerCase()}.koios.rest/api/v1`,
            );

      const getProtocolParameters = () =>
        Effect.tryPromise(() => provider.getProtocolParameters());
      const getUtxos = (addressOrCredential: string) =>
        Effect.tryPromise(() => provider.getUtxos(addressOrCredential));
      const getUtxosWithUnit = (addressOrCredential: string, unit: string) =>
        Effect.tryPromise(() =>
          provider.getUtxosWithUnit(addressOrCredential, unit),
        );
      const getUtxoByUnit = (unit: string) =>
        Effect.tryPromise(() => provider.getUtxoByUnit(unit));
      const getUtxosByOutRef = (outRefs: Array<OutRef>) =>
        Effect.tryPromise(() => provider.getUtxosByOutRef(outRefs));
      const getDelegation = (rewardAddress: string) =>
        Effect.tryPromise(() => provider.getDelegation(rewardAddress));
      const getDatum = (datumHash: string) =>
        Effect.tryPromise(() => provider.getDatum(datumHash));
      const awaitTx = (txHash: string) =>
        Effect.tryPromise(() => provider.awaitTx(txHash));
      const submitTx = (tx: string) =>
        Effect.tryPromise(() => provider.submitTx(tx));
      const evaluateTx = (tx: string) =>
        Effect.tryPromise(() => provider.evaluateTx(tx));

      return {
        getProtocolParameters,
        getUtxos,
        getUtxosWithUnit,
        getUtxoByUnit,
        getUtxosByOutRef,
        getDelegation,
        getDatum,
        awaitTx,
        submitTx,
        evaluateTx,
      } as const;
    }),
    dependencies: [ProjectConfig.ProjectConfig.Default],
  },
) {}
