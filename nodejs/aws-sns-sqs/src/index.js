var express = require('express');
var { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
var { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

var app = express();
app.use(express.json());

var PORT = 8080;

var AWS_REGION = process.env.AWS_REGION || 'us-east-1';
var AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localstack:4566';

var SQS_DIRECT_QUEUE_URL = process.env.SQS_DIRECT_QUEUE_URL || AWS_ENDPOINT + '/000000000000/sqs-direct-queue';
var SQS_SNS_QUEUE_URL = process.env.SQS_SNS_QUEUE_URL || AWS_ENDPOINT + '/000000000000/sns-forwarded-queue';
var SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || 'arn:aws:sns:' + AWS_REGION + ':000000000000:sns-sqs-topic';

var awsConfig = {
  region: AWS_REGION,
  endpoint: AWS_ENDPOINT,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
};

var snsClient = new SNSClient(awsConfig);
var sqsClient = new SQSClient(awsConfig);

app.get('/health', function (req, res) {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 1. Send a message directly to the SQS direct queue
app.post('/sqs/send', function (req, res) {
  var message = req.body.message || 'Direct SQS message at ' + new Date().toISOString();

  console.log('sqs/send: sending message to direct SQS queue');

  var command = new SendMessageCommand({
    QueueUrl: SQS_DIRECT_QUEUE_URL,
    MessageBody: message,
  });

  sqsClient.send(command)
    .then(function (result) {
      console.log('sqs/send: message sent, MessageId=' + result.MessageId);
      res.json({
        status: 'sent',
        messageId: result.MessageId,
        queueUrl: SQS_DIRECT_QUEUE_URL,
        message: message,
      });
    })
    .catch(function (err) {
      console.error('sqs/send: error:', err.message);
      res.status(500).json({ error: err.message });
    });
});

// 2. Publish a message to SNS (forwarded to the SNS-SQS queue)
app.post('/sns/publish', function (req, res) {
  var message = req.body.message || 'SNS message at ' + new Date().toISOString();
  var subject = req.body.subject || 'sns-notification';

  console.log('sns/publish: publishing message to SNS topic — subject=' + subject);

  var command = new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Message: message,
    Subject: subject,
  });

  snsClient.send(command)
    .then(function (result) {
      console.log('sns/publish: message published, MessageId=' + result.MessageId);
      res.json({
        status: 'published',
        messageId: result.MessageId,
        topicArn: SNS_TOPIC_ARN,
        message: message,
      });
    })
    .catch(function (err) {
      console.error('sns/publish: error:', err.message);
      res.status(500).json({ error: err.message });
    });
});

// 3. Poll the direct SQS queue
app.get('/sqs/receive', function (req, res) {
  var maxMessages = parseInt(req.query.max) || 10;

  console.log('sqs/receive: polling direct SQS queue (max=' + maxMessages + ')');

  var command = new ReceiveMessageCommand({
    QueueUrl: SQS_DIRECT_QUEUE_URL,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: 1,
  });

  sqsClient.send(command)
    .then(function (result) {
      var messages = (result.Messages || []).map(function (msg) {
        return {
          messageId: msg.MessageId,
          body: msg.Body,
          receiptHandle: msg.ReceiptHandle,
        };
      });
      console.log('sqs/receive: got ' + messages.length + ' message(s)');
      res.json({ count: messages.length, messages: messages });
    })
    .catch(function (err) {
      console.error('sqs/receive: error:', err.message);
      res.status(500).json({ error: err.message });
    });
});

// 4. Poll the SNS-forwarded SQS queue
app.get('/sns/receive', function (req, res) {
  var maxMessages = parseInt(req.query.max) || 10;

  console.log('sns/receive: polling SNS-forwarded SQS queue (max=' + maxMessages + ')');

  var command = new ReceiveMessageCommand({
    QueueUrl: SQS_SNS_QUEUE_URL,
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: 1,
  });

  sqsClient.send(command)
    .then(function (result) {
      var messages = (result.Messages || []).map(function (msg) {
        return {
          messageId: msg.MessageId,
          body: msg.Body,
          receiptHandle: msg.ReceiptHandle,
        };
      });
      console.log('sns/receive: got ' + messages.length + ' message(s)');
      res.json({ count: messages.length, messages: messages });
    })
    .catch(function (err) {
      console.error('sns/receive: error:', err.message);
      res.status(500).json({ error: err.message });
    });
});

var server = app.listen(PORT, function () {
  console.log('aws-sns-sqs server running at http://127.0.0.1:' + PORT + '/');
  console.log('Available endpoints:');
  console.log('  POST /sqs/send     — send a message directly to the SQS queue');
  console.log('  POST /sns/publish  — publish a message to SNS (forwarded to SQS)');
  console.log('  GET  /sqs/receive  — poll the direct SQS queue');
  console.log('  GET  /sns/receive  — poll the SNS-forwarded SQS queue');
});

process.on('SIGTERM', function () {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(function () {
    console.log('HTTP server closed');
    process.exit(0);
  });
  setTimeout(function () {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});
