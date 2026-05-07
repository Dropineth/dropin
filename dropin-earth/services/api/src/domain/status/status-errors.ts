export class LaunchCheckNotFoundError extends Error {
  constructor(launchCheckId: string) {
    super(`Launch check not found: ${launchCheckId}`);
    this.name = "LaunchCheckNotFoundError";
  }
}
