const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-consumer-app',
  brokers: ['172.30.235.186:9092']
});

const consumer = kafka.consumer({ groupId: 'default-group' });

const runConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'asdf', fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log({
        topic,
        partition,
        offset: message.offset,
        value: message.value.toString(),
      });
    },
  });
};

runConsumer().catch(console.error);
