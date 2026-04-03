#!/bin/bash
# EchoCoder Agent Mock (Stub)
# Used for CI environments where real binaries or API keys are unavailable.

echo '{"type": "system", "subtype": "init", "message": "EchoCoder Agent Mock Started"}'
echo '{"type": "status", "message": "Mock status update"}'
echo '{"type": "log", "message": "Mock log message"}'

# Simulate a brief delay to mimic real agent initialization
sleep 1

# Emit a completion event
echo '{"type": "system", "subtype": "completed", "message": "Agent Run Finished (Mock)"}'

exit 0
