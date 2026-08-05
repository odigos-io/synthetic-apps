import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Post, Get, Body, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import * as amqp from 'amqplib';

const FASTAPI = process.env.FASTAPI_URL || 'http://fastapi-products.stacks-messaging.svc.cluster.local:8080';
const QUARKUS = process.env.QUARKUS_URL || 'http://quarkus-pricing.stacks-messaging.svc.cluster.local:8080';
const GIN = process.env.GIN_URL || 'http://gin-recommendations.stacks-messaging.svc.cluster.local:8080';
const RABBIT = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq.stacks-messaging.svc.cluster.local:5672';
const QUEUE = process.env.RABBITMQ_QUEUE || 'catalog-events';

let channel: amqp.Channel;

async function publish(msg: object) {
  if (!channel) throw new Error('rabbitmq not ready');
  channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(msg)), { persistent: true });
}

@Controller()
class GatewayController {
  @Get('health')
  health() {
    return { status: 'healthy', stack: 'messaging', gateway: 'nestjs' };
  }

  @Get('transactions')
  listTransactions() {
    return {
      transactions: [
        { name: 'publish-product', path: '/transactions/publish-product', order: 'rabbitmq → fastapi/mongo → gin' },
        { name: 'apply-pricing', path: '/transactions/apply-pricing', order: 'quarkus/mongo → rabbitmq → fastapi' },
        { name: 'sync-recommendations', path: '/transactions/sync-recommendations', order: 'gin → fastapi → quarkus' },
      ],
    };
  }

  @Post('transactions/publish-product')
  @Header('X-Transaction-Name', 'publish-product')
  async publishProduct(@Body() body: Record<string, string>, @Res() res: Response) {
    const key = body.key || 'prod-1';
    const value = body.value || 'widget';
    const steps: object[] = [];
    try {
      await publish({ type: 'publish-product', key, value, ts: new Date().toISOString() });
      steps.push({ service: 'rabbitmq', action: 'publish', queue: QUEUE });
      const p = await fetch(`${FASTAPI}/products`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: key, name: value, price: 9.99 }),
      });
      steps.push({ service: 'fastapi-products', status: p.status });
      const g = await fetch(`${GIN}/recommend/${encodeURIComponent(key)}`);
      steps.push({ service: 'gin-recommendations', status: g.status, body: await g.json() });
      res.json({ transaction: 'publish-product', key, steps });
    } catch (e: any) {
      res.status(500).json({ transaction: 'publish-product', error: e.message, steps });
    }
  }

  @Post('transactions/apply-pricing')
  @Header('X-Transaction-Name', 'apply-pricing')
  async applyPricing(@Body() body: Record<string, string>, @Res() res: Response) {
    const key = body.key || 'prod-1';
    const steps: object[] = [];
    try {
      const q = await fetch(`${QUARKUS}/price/${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount: 0.1 }),
      });
      steps.push({ service: 'quarkus-pricing', status: q.status, body: await q.json() });
      await publish({ type: 'apply-pricing', key, ts: new Date().toISOString() });
      steps.push({ service: 'rabbitmq', action: 'publish' });
      const p = await fetch(`${FASTAPI}/products/${encodeURIComponent(key)}`);
      steps.push({ service: 'fastapi-products', status: p.status });
      res.json({ transaction: 'apply-pricing', key, steps });
    } catch (e: any) {
      res.status(500).json({ transaction: 'apply-pricing', error: e.message, steps });
    }
  }

  @Post('transactions/sync-recommendations')
  @Header('X-Transaction-Name', 'sync-recommendations')
  async syncRecommendations(@Body() body: Record<string, string>, @Res() res: Response) {
    const key = body.key || 'prod-1';
    const steps: object[] = [];
    try {
      const g = await fetch(`${GIN}/recommend/${encodeURIComponent(key)}`);
      steps.push({ service: 'gin-recommendations', status: g.status, body: await g.json() });
      const p = await fetch(`${FASTAPI}/products/${encodeURIComponent(key)}`);
      steps.push({ service: 'fastapi-products', status: p.status });
      const q = await fetch(`${QUARKUS}/price/${encodeURIComponent(key)}`);
      steps.push({ service: 'quarkus-pricing', status: q.status });
      res.json({ transaction: 'sync-recommendations', key, steps });
    } catch (e: any) {
      res.status(500).json({ transaction: 'sync-recommendations', error: e.message, steps });
    }
  }
}

@Module({ controllers: [GatewayController] })
class AppModule {}

async function bootstrap() {
  await new Promise((r) => setTimeout(r, 8000));
  const conn = await amqp.connect(RABBIT);
  channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  const app = await NestFactory.create(AppModule);
  await app.listen(8080);
  console.log('messaging-gateway (NestJS) ready — 3 transactions');
}
bootstrap();
