module.exports = {
    apps: [{
      name: "LingFlow",
      script: "./start-python-env.sh",
      interpreter: "bash",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      node_args: [
        "--max-old-space-size=1024",
        "--expose-gc"
      ]
    }]
  }