module.exports = {
  apps: [
    {
      name: 'sitepilot-api',
      script: 'C:\\deanreport\\run-api.bat',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '5s',
    },
    {
      name: 'sitepilot-web',
      script: 'C:\\deanreport\\run-web.bat',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
    },
  ],
}
