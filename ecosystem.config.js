module.exports = {
    apps: [{
      name: "LingFlow",
      script: "./start-python-env.sh",
      interpreter: "bash",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      }
    }]
  }