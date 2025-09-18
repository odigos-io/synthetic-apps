require('dotenv').config();
const env = require('env-var');

module.exports = {
    NUM_OF_EXPORTERS: env.get('NUM_OF_EXPORTERS').default(1).asInt(),
    ATTRIBUTES_PER_SPAN: env.get('ATTRIBUTES_PER_SPAN').default(20).asInt(),
    BIG_ATTRIBUTE_SIZE_KB: env.get('BIG_ATTRIBUTE_SIZE_CHARS').default(10*1024).asInt(),
    SPANS_PER_BATCH: env.get('SPANS_PER_BATCH').default(1024).asInt(),
    BATCHES_PER_SECOND: env.get('BATCHES_PER_SECOND').default(1).asInt(),
}
