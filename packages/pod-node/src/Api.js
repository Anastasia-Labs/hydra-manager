import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { Schema } from "effect"

export class StartApi extends HttpApiGroup.make("start")
  .prefix("/start")
  .add(
    HttpApiEndpoint.get("start", "/start")
      .addSuccess(Schema.String)
    //   .setPayload(Person.jsonCreate)
      .addError(Schema.Any)
  )
  .annotate(OpenApi.Title, "Start")
  .annotate(OpenApi.Description, "Start thingy")
{}

export class Api extends HttpApi.empty
  .add(StartApi)
  .annotate(OpenApi.Title, "API")
{}
