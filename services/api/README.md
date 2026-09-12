# API service

Phase 1 Lambda entry points include a public health check and JWT-protected personal identity/membership response. Manager/HR and admin functions are deployed with separate DynamoDB IAM namespaces but are not routed until their APIs exist. Phase 2 adds personal consent, task, check-in, private-item, trend, observation, and correction handlers.
