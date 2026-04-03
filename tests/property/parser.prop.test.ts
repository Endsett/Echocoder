import * as fc from 'fast-check';
import { NDJSONParser } from '../../src/core/NDJSONParser';

/**
 * Property-Based Test for NDJSONParser
 * 
 * Verifies that the parser never crashes (boundary resilience)
 * when fed arbitrary strings, including malicious or corrupted NDJSON.
 */
async function testParserResilience() {
  console.log('Running Property Test: NDJSONParser Resilience');
  
  fc.assert(
    fc.property(fc.fullUnicodeString(), (input) => {
      const parser = new NDJSONParser(
        () => {}, // No-op event handler
        () => {}  // No-op error handler
      );
      
      // Feed random unicode strings
      // If this throws an unhandled exception, the property is violated
      parser.feed(input);
      parser.flush();
      
      return true;
    }),
    { numRuns: 1000 }
  );

  console.log('✅ NDJSONParser Resilience: Passed 1000 runs');
}

(async () => {
  try {
    await testParserResilience();
    process.exit(0);
  } catch (err) {
    console.error('❌ Property Test Failed:', err);
    process.exit(1);
  }
})();
