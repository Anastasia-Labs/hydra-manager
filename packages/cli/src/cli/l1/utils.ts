import util from "util"

export const logObject = (value: any) => {
  if (typeof value != "object") {
    console.log(value)
  }
  console.log(
    util.inspect(value, { showHidden: false, depth: null, colors: true })
  )
}
