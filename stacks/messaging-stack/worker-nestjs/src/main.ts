import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get } from '@nestjs/common';
import * as amqp from 'amqplib';

const RABBIT = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq.stacks-messaging.svc.cluster.local:5672';
const QUEUE = process.env.RABBITMQ_QUEUE || 'catalog-events';
const FASTAPI = process.env.FASTAPI_URL || 'http://fastapi-products:8080';

let processed = 0;
let lastMessage = '';

@Controller()
class WorkerController {
  @Get('health')
  health() {
    return { status: 'healthy', stack: 'messaging', framework: 'nestjs-worker', processed, lastMessage };
  }
}

@Module({ controllers: [WorkerController] })
class AppModule {}

async function consume() {
  await new Promise((r) => setTimeout(r, 12000));
  const conn = await amqp.connect(RABBIT);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    processed++;
    lastMessage = msg.content.toString();
    console.log(`[worker] #${processed} ${lastMessage}`);
    try {
      const body = JSON.parse(lastMessage);
      if (body.key) await fetch(`${FASTAPI}/products/${encodeURIComponent(body.key)}`);
    } catch (e) {
      console.error('[worker] error', e);
    }
    ch.ack(msg);
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(8080);
  consume().catch(console.error);
  console.log('messaging-worker (NestJS) on :8080');
}
bootstrap();
