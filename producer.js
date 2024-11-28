const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: '1',
  brokers: ["172.30.235.186:9092"]
});

const producer = kafka.producer();

const runProducer = async () => {
  // await connection
  await producer.connect();

  // send a message if connected
  await producer.send({
    topic: 'asdf',
    messages: [
      { value: 'helloworld' },
      { value: 'hellowords' },
    ],
  });

  console.log('message sent successfully');
  await producer.disconnect();
};

runProducer().catch(console.error);
