const http = require('http')
const fs = require('fs')
const path = require('path')
const mime = require('mime')
const chatServer = require('./lib/chat_server')

let cache = {} // cache用来缓存文件

// 响应404的方法
function send404(response) {
  response.writeHead(404, { 'Content-Type': 'text/plain' }) // 写入响应头
  response.write('Error 404: resource not found') // 写入响应体
  response.end() // 结束本次响应，如果不写则不会响应结束
}

// 这个函数先写出正确的HTTP头，然后发送文件的内容
function sendFile(response, filePath, fileContents) {
  // console.log(mime)
  response.writeHead(200, { 'Content-Type': mime.getType(path.basename(filePath)) })
  response.end(fileContents)
}

// 检查文件是否在内存中
function serveStatic(response, cache, absPath) {
  // 如果在缓存对象中，则直接发送数据
  if (cache[absPath]) {
    sendFile(response, absPath, cache[absPath])
  } else {
    // 检查文件是否在本地存在
    fs.exists(absPath, function (exists) {
      // 如果存在，则读取文件
      if (exists) {
        fs.readFile(absPath, function (err, data) {
          // 如果文件读取出错，则发送404；没出错就加到缓存对象中,并发送数据
          if (err) {
            send404(response)
          } else {
            cache[absPath] = data
            sendFile(response, absPath, cache[absPath])
          }
        })
      } else {
        send404(response)
      }
    })
  }
}

// 创建HTTP服务的逻辑
let server = http.createServer(function (request, response) {
  let filePath = ''
  if (request.url === '/') {
    // 如果请求是根目录，则返回主页
    filePath = 'public/index.html'
  } else {
    // 将URL路径转换为文件的相对路径
    filePath = 'public' + request.url
  }

  // 生成可读取的路径
  let absPath = './' + filePath
  serveStatic(response, cache, absPath)
})

// 启动服务器监听8888端口
server.listen(8888, function () {
  console.log('Server listening on port 8888. You can click http://127.0.0.1:8888')
})

// 启动socket.io服务器，给它提供一个已经定义好的HTTP服务器，这样它就能跟HTTP服务器共享同一个TCP/IP端口
chatServer.listen(server)