function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

module.exports = {
  port: Number(env("PORT", "8080")),
  projectId: env("GOOGLE_CLOUD_PROJECT", "amir-playground-499009"),
  legacyTopicName: env("PUBSUB_LEGACY_TOPIC", env("PUBSUB_TOPIC", "legacy-publish-topic")),
  legacySubscriptionName: env(
    "PUBSUB_LEGACY_SUBSCRIPTION",
    env("PUBSUB_SUBSCRIPTION", "legacy-publish-subscription")
  ),
  publishMessageTopicName: env("PUBSUB_PUBLISH_MESSAGE_TOPIC", "publish-message-topic"),
  publishMessageSubscriptionName: env(
    "PUBSUB_PUBLISH_MESSAGE_SUBSCRIPTION",
    "publish-message-subscription"
  ),
  publishIntervalMs: Number(env("PUBLISH_INTERVAL_MS", "10000")),
  startupDelayMs: Number(env("STARTUP_DELAY_MS", "3000")),
  processDelayMs: Number(env("PROCESS_DELAY_MS", "25")),
};
