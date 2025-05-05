import { Status } from "./Node.js";
import { Effect, Option, Schema } from "effect";

export const processStatus = (data: string) => {
  const message = Schema.decode(Schema.parseJson())(data);

  const getStatus = (data: any) => {
    if (data.headStatus !== undefined) {
      return (data.headStatus as string).toUpperCase() as Status;
    }

    switch (data.tag) {
      case "Greetings":
        return (data.headStatus as string).toUpperCase() as Status;
      case "HeadIsInitializing":
        return "INITIALIZING";
      case "HeadIsOpen":
        return "OPEN";
      case "HeadIsClosed":
        return "CLOSED";
      case "ReadyToFanout":
        return "FANOUT_POSSIBLE";
      case "HeadIsFinalized":
        return "FINAL";
      default:
        return null;
    }
  };

  const parseStatus = Option.liftPredicate((p: Status | null) => p !== null);

  return Effect.match(message, {
    onSuccess: (data) => parseStatus(getStatus(data)),
    onFailure: () => Option.none<Status>(),
  });
};
