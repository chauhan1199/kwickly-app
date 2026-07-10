module.exports = {
  apps: [
    {
      name: 'kwickly-backend',
      script: './src/server.js',
      instances: 'max',          // Run on all available CPU cores
      exec_mode: 'cluster',      // Enable PM2 Clustering (Redis locks prevent duplicate Crons)
      watch: false,              // Do not watch in production
      max_memory_restart: '1G',  // Restart if memory leaks beyond 1GB
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2_error.log',
      out_file: './logs/pm2_out.log',
      merge_logs: true,
      time: true
    }
  ]
};
