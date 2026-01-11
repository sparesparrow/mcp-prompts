const { CognitiveMaturationService } = require('../dist/core/services/cognitive-maturation.service');

async function testCognitiveMaturation() {
  console.log('Testing cognitive maturation service...');

  try {
    // Create the service - this would normally be done through DI
    const service = new CognitiveMaturationService(null, null, null, null, null);

    // Execute learning cycle
    const results = await service.executeLearningCycle();
    console.log('Learning cycle completed:', results);

  } catch (error) {
    console.error('Error testing cognitive maturation:', error);
  }
}

testCognitiveMaturation();

