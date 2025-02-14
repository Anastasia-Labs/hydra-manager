class Monitor {
  shouldExit: boolean = false

  constructor() {}

  finished(): boolean {
    return this.shouldExit
  }

  kill() {
    this.shouldExit = true
  }

  async sleep(
    minSecondsWait: number = 10,
    maxSecondsWait: number = 60
  ): Promise<void> {
    const secondsToWait = Math.floor(
      Math.random() * (maxSecondsWait * 1000 - minSecondsWait * 1000 + 1)
    ) +
      minSecondsWait * 1000
    const stopAfter = new Date(new Date().getTime() + secondsToWait)

    return new Promise<void>((resolve) => {
      const intervalId = setInterval(() => {
        if (this.shouldExit || new Date() > stopAfter) {
          clearInterval(intervalId)
          resolve()
        }
      }, 500)
    })
  }
}

export { Monitor }
