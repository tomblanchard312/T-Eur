const VALID_ENVIRONMENTS = ['lab', 'test', 'pilot', 'prod'];

class Config {
  constructor() {
    this.env = process.env.TEUR_ENV;
    if (!this.env || !VALID_ENVIRONMENTS.includes(this.env)) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        severity: 'ERROR',
        component: 'reconciliation-ref',
        event_type: 'invalid_environment',
        message: `TEUR_ENV must be one of: ${VALID_ENVIRONMENTS.join(', ')}, got: ${this.env || 'undefined'}`
      }));
      process.exit(1);
    }

    // Environment-specific configuration
    this.config = {
      lab: {
        storage: 'file',
        maxBatchSize: 100,
        maxRequestSize: '1mb',
        retentionDays: 30
      },
      test: {
        storage: 'memory',
        maxBatchSize: 50,
        maxRequestSize: '500kb',
        retentionDays: 1
      },
      pilot: {
        storage: 'rotating-file',
        maxBatchSize: 1000,
        maxRequestSize: '5mb',
        retentionDays: 90,
        rotationIntervalHours: 24
      },
      prod: {
        storage: 'durable',
        maxBatchSize: 5000,
        maxRequestSize: '10mb',
        retentionDays: 2555, // 7 years
        rotationIntervalHours: 168 // weekly
      }
    };

    this.current = this.config[this.env];

    // Log environment resolution
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      component: 'reconciliation-ref',
      event_type: 'environment_startup',
      environment: this.env,
      config: this.current
    }));
  }

  get environment() {
    return this.env;
  }

  get storageType() {
    return this.current.storage;
  }

  get maxBatchSize() {
    return this.current.maxBatchSize;
  }

  get maxRequestSize() {
    return this.current.maxRequestSize;
  }

  get retentionDays() {
    return this.current.retentionDays;
  }

  get rotationIntervalHours() {
    return this.current.rotationIntervalHours;
  }
}

module.exports = new Config();