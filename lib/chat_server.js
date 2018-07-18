const socketio = require('socket.io')
let io
let guestNumber = 1
let nickNames = {}
let nameUsed = []
let currentRoom = {}

exports.listen = function (server) {
  // 启动socket服务
  io = socketio.listen(server)
  io.set('log leave', 1)
  // 定义每个用户连接的处理逻辑
  io.sockets.on('connection', function (socket) {
    // 在用户连接上来时赋予他一个访客名
    guestNumber = assignGuestName(socket, guestNumber, nickNames, nameUsed)
    // 将新来的用户放到lobby聊天室
    joinRoom(socket, 'lobby')
    // 处理用户聊天室更名，以及聊天室的创建和变更
    handleMessageBroadcasting(socket, nickNames)
    handleNameChangeAttempts(socket, nickNames, nameUsed)
    handleRoomJoining(socket)
    // 用户发出请求时，向其提供已经被占用的聊天室列表
    socket.on('rooms', function () {
      socket.emit('rooms', io.sockets.manager.rooms)
    })
    // 定义用户断开连接之后的清除逻辑
    handleClientDisconnection(socket, nickNames, nameUsed)
  })
}

function assignGuestName(socket, guestNumber, nickNames, nameUsed) {
  let name = 'Guest' + guestNumber
  nickNames[socket.id] = name
  socket.emit('nameResult', {
    success: true,
    name: name
  })
  nameUsed.push(name)
  return guestNumber + 1
}

function joinRoom(socket, room) {
  socket.join(room)
  currentRoom[socket.id] = room
  socket.emit('joinResult', { room: room })
  socket.broadcast.to(room).emit('message', {
    text: nickNames[socket.id] + ' has joined ' + room + '.'
  })

  let usersInRoom = io.sockets.clients(room)
  if (usersInRoom.length > 1) {
    let usersInRoomSummary = 'User currently in ' + room + '.'
    for (let index in usersInRoom) {
      let userSocketId = usersInRoom[index].id
      if (userSocketId !== socket.id) {
        if (index > 0) {
          usersInRoomSummary += ','
        }
        usersInRoomSummary += nickNames[userSocketId]
      }
    }
    usersInRoomSummary += '.'
    socket.emit('message', { text: usersInRoomSummary })
  }
}

function handleNameChangeAttempts(socket, nickNames, nameUsed) {
  socket.on('nameAttempts', function (name) {
    if (name.indexOf('Guest') === 0) {
      socket.emit('nameResult', {
        success: false,
        message: 'Name cannot begin with "Guest".'
      })
    } else {
      if (nameUsed.indexOf(name) === -1) {
        let previousName = nickNames[socket.id]
        let previousNameIndex = nameUsed.indexOf(previousName)
        nameUsed.push(name)
        nickNames[socket.id] = name
        delete nameUsed[previousNameIndex]
        socket.emit('nameResult', {
          success: true,
          name: name
        })
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: previousName + ' is now known as ' + name + '.'
        })
      } else {
        socket.emit('nameResult', {
          success: false,
          message: 'That name is already in use.'
        })
      }
    }
  })
}

function handleMessageBroadcasting(socket) {
  socket.on('message', function (message) {
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ': ' + message.text
    })
  })
}

function handleRoomJoining(socket) {
  socket.on('join', function (room) {
    socket.leave(currentRoom[socket.id])
    joinRoom(socket, room.newRoom)
  })
}

function handleClientDisconnection(socket) {
  socket.on('disconnection', function () {
    let nameIndex = nameUsed.indexOf(nickNames[socket.id])
    delete nameUsed[nameIndex]
    delete nickNames[socket.id]
  })
}