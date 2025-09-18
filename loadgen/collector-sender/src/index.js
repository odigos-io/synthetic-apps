
const config = require('./config');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { SpanKind, SpanStatusCode, SpanAttributes, Link, TimedEvent, HrTime, InstrumentationLibrary, SpanContext, IResource, TraceFlags } = require('@opentelemetry/api');
const { RandomIdGenerator } = require('@opentelemetry/sdk-trace-base');
const { timeInputToHrTime } = require('@opentelemetry/core');
const { Resource } = require('@opentelemetry/resources');

const createExporters = (numExporters) => {
    const exporters = [];
    for (let i = 0; i < numExporters; i++) {
        exporters.push(new OTLPTraceExporter({
            compression: "none",
        }));
    }
    return exporters;
}

const idGenerator = new RandomIdGenerator();
const exporters = createExporters(config.NUM_OF_EXPORTERS);

const generateRandomSpan = () => {
    const attributes = {};
    for (let i = 0; i < config.ATTRIBUTES_PER_SPAN; i++) {
        attributes[`odigos.test.attr.${i}`] = `value-${i}`;
    }
    const span = {
        name: 'loadgen synthetic span',
        kind: SpanKind.INTERNAL,
        spanContext: () => {
            return {
                traceId: idGenerator.generateTraceId(),
                spanId: idGenerator.generateSpanId(),
                traceFlags: TraceFlags.SAMPLED,
            }
        },
        // parentSpanId: all spans are root spans for simplicity
        startTime: timeInputToHrTime(new Date()),
        endTime: timeInputToHrTime(new Date(Date.now() + 10)),
        status: {
            code: SpanStatusCode.UNSET,
        },
        attributes,
        links: [],
        events: [],
        duration: 10 * 1000 * 1000, // 10 millis in nanoseconds
        ended: true,
        resource: {
            attributes: {
                'service.name': 'loadgen-synthetic-span',
            },
        },
        instrumentationScope: {
            name: 'loadgen-synthetic-span',
        }
    };
    return span;
}

const everySecond = async (traces) => {
    for (let i = 0; i < config.BATCHES_PER_SECOND; i++) {
        exporters.forEach(exporter => {
            exporter.export(traces, (result) => {
                console.log('Exported batch error', { time: new Date().toISOString(), error: result.error.code });
            });
        });
    }
}

const traces = [];
for (let j = 0; j < config.SPANS_PER_BATCH; j++) {
    traces.push(generateRandomSpan());
}

setInterval(async () => {
    everySecond(traces);
}, 1000);

process.on('SIGTERM', () => {
    console.log('Received SIGTERM signal, shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT signal, shutting down...');
    process.exit(0);
});
