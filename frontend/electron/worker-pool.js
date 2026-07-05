const { Worker } = require('worker_threads')
const path = require('path')
const os = require('os')

class WorkerPool {
  constructor(maxWorkers = Math.max(2, os.cpus().length - 1)) {
    this.maxWorkers = maxWorkers
    this.workers = new Map() // id -> { worker, busy, startTime, taskId }
    this.taskQueue = [] // { resolve, reject, task }
    this.taskCounter = 0
    this.workerCounter = 0

    // 定期检查卡死的线程（30秒超时）
    this.checkInterval = setInterval(() => this.checkStuckWorkers(), 10000)
  }

  // 获取或创建一个空闲 worker
  getWorker() {
    // 查找空闲 worker
    for (const [id, workerInfo] of this.workers) {
      if (!workerInfo.busy) {
        return id
      }
    }

    // 创建新 worker（如果未达到上限）
    if (this.workers.size < this.maxWorkers) {
      return this.createWorker()
    }

    return null // 需要等待
  }

  // 创建新 worker
  createWorker() {
    const id = `worker-${++this.workerCounter}`
    const worker = new Worker(path.join(__dirname, 'worker-task.js'))

    this.workers.set(id, {
      worker,
      busy: false,
      startTime: 0,
      taskId: null,
    })

    worker.on('message', (msg) => {
      if (msg.type === 'result') {
        // 找到对应的 task 并 resolve
        const workerInfo = this.workers.get(id)
        if (workerInfo) {
          workerInfo.busy = false
          workerInfo.taskId = null
        }
        const task = this.pendingTasks.get(msg.taskId)
        if (task) {
          task.resolve(msg.result)
          this.pendingTasks.delete(msg.taskId)
        }
        // 处理等待队列
        this.processQueue()
      } else if (msg.type === 'error') {
        const workerInfo = this.workers.get(id)
        if (workerInfo) {
          workerInfo.busy = false
          workerInfo.taskId = null
        }
        const task = this.pendingTasks.get(msg.taskId)
        if (task) {
          task.reject(new Error(msg.error))
          this.pendingTasks.delete(msg.taskId)
        }
        // 处理等待队列
        this.processQueue()
      } else if (msg.type === 'progress') {
        const task = this.pendingTasks.get(msg.taskId)
        if (task && task.onProgress) {
          task.onProgress(msg.progress)
        }
      }
    })

    worker.on('error', (err) => {
      console.error(`[WorkerPool] Worker ${id} error:`, err)
      const workerInfo = this.workers.get(id)
      if (workerInfo) {
        workerInfo.busy = false
        const task = this.pendingTasks.get(workerInfo.taskId)
        if (task) {
          task.reject(err)
          this.pendingTasks.delete(workerInfo.taskId)
        }
        this.workers.delete(id)
      }
    })

    worker.on('exit', (code) => {
      console.log(`[WorkerPool] Worker ${id} exited with code ${code}`)
      this.workers.delete(id)
    })

    return id
  }

  // 执行任务
  async execute(taskData, onProgress = null) {
    return new Promise((resolve, reject) => {
      const taskId = `task-${++this.taskCounter}`

      // 存储 pending task
      if (!this.pendingTasks) this.pendingTasks = new Map()
      this.pendingTasks.set(taskId, { resolve, reject, onProgress, startTime: Date.now() })

      const workerId = this.getWorker()
      if (workerId) {
        this.assignTask(workerId, taskId, taskData)
      } else {
        // 加入队列等待
        this.taskQueue.push({ taskId, taskData })
      }
    })
  }

  // 分配任务给 worker
  assignTask(workerId, taskId, taskData) {
    const workerInfo = this.workers.get(workerId)
    if (!workerInfo) return

    workerInfo.busy = true
    workerInfo.startTime = Date.now()
    workerInfo.taskId = taskId

    workerInfo.worker.postMessage({ taskId, ...taskData })
  }

  // 检查卡死的线程
  checkStuckWorkers() {
    const now = Date.now()
    const TIMEOUT = 60000 // 60秒超时

    for (const [id, workerInfo] of this.workers) {
      if (workerInfo.busy && (now - workerInfo.startTime) > TIMEOUT) {
        console.warn(`[WorkerPool] Worker ${id} stuck for ${TIMEOUT}ms, terminating...`)

        // reject 对应的 task
        if (this.pendingTasks && workerInfo.taskId) {
          const task = this.pendingTasks.get(workerInfo.taskId)
          if (task) {
            task.reject(new Error('转换超时'))
            this.pendingTasks.delete(workerInfo.taskId)
          }
        }

        // 终止 worker
        workerInfo.worker.terminate()
        this.workers.delete(id)
      }
    }

    // 处理等待队列
    this.processQueue()
  }

  // 处理等待队列
  processQueue() {
    while (this.taskQueue.length > 0) {
      const workerId = this.getWorker()
      if (!workerId) break

      const { taskId, taskData } = this.taskQueue.shift()
      this.assignTask(workerId, taskId, taskData)
    }
  }

  // 获取状态
  getStatus() {
    let busyCount = 0
    for (const [, info] of this.workers) {
      if (info.busy) busyCount++
    }
    return {
      totalWorkers: this.workers.size,
      busyWorkers: busyCount,
      queueLength: this.taskQueue.length,
      maxWorkers: this.maxWorkers,
    }
  }

  // 关闭所有 worker
  async shutdown() {
    clearInterval(this.checkInterval)
    for (const [id, info] of this.workers) {
      await info.worker.terminate()
    }
    this.workers.clear()
    this.taskQueue = []
  }
}

module.exports = WorkerPool
