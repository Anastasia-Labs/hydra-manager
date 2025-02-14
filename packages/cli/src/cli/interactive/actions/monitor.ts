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
    milliseconds: number = 30 * 1000
  ): Promise<void> {
    const stopAfter = new Date(Date.now() + milliseconds)

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
