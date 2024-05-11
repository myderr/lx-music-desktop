import http from 'node:http'
import querystring from 'node:querystring'
import type { Socket } from 'node:net'
import { getAddress } from '@common/utils/nodejs'
// import { getMusicUrl } from '@/renderer/core/music/index'
// import { deduplicationList, toNewMusicInfo } from '@../../renderer/utils'
// import { markRawList } from '@common/utils/vueTools'
import { getListDetail, getOnlineMusicUrl } from '../winMain/rendererEvent'
// import { sendRequest } from '@main/modules/userApi'

let status: LX.OpenAPI.Status = {
  status: false,
  message: '',
  address: '',
}

// type MusicInfoOnline = LX.Music.MusicInfoOnline & {
//   url: string
// }

type SubscribeKeys = keyof LX.Player.Status

let httpServer: http.Server
let sockets = new Set<Socket>()
let responses = new Map<http.ServerResponse<http.IncomingMessage>, SubscribeKeys[]>()

const parseFilter = (filter: any) => {
  const keys = Object.keys(global.lx.player_status) as SubscribeKeys[]
  if (typeof filter != 'string') return keys
  filter = filter.split(',')
  const subKeys = keys.filter(k => filter.includes(k))
  return subKeys.length ? subKeys : keys
}
const handleSubscribePlayerStatus = (req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage>, query?: string) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  })
  req.socket.setTimeout(0)
  req.on('close', () => {
    res.end('OK')
    responses.delete(res)
  })
  const keys = parseFilter(querystring.parse(query ?? '').filter)
  responses.set(res, keys)
  for (const [k, v] of Object.entries(global.lx.player_status)) {
    if (!keys.includes(k as SubscribeKeys)) continue
    res.write(`event: ${k}\n`)
    res.write(`data: ${JSON.stringify(v)}\n\n`)
  }
}

async function waitSeconds(seconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, seconds * 1000)
  })
}

const handleStartServer = async(port: number, ip: string) => new Promise<void>((resolve, reject) => {
  httpServer = http.createServer(async(req, res): Promise<void> => {
    const [endUrl, query] = `/${req.url?.split('/').at(-1) ?? ''}`.split('?')
    let code
    let msg
    switch (endUrl) {
      case '/status':
        code = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        msg = JSON.stringify({
          status: global.lx.player_status.status,
          name: global.lx.player_status.name,
          singer: global.lx.player_status.singer,
          albumName: global.lx.player_status.albumName,
          duration: global.lx.player_status.duration,
          progress: global.lx.player_status.progress,
          picUrl: global.lx.player_status.picUrl,
          playbackRate: global.lx.player_status.playbackRate,
          lyricLineText: global.lx.player_status.lyricLineText,
        })
        break
      case '/test': {
        code = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        let q = new URLSearchParams(query)
        let source = q.get('source') as LX.OnlineSource
        let search = q.get('search')
        let ret = null
        if (search != null) {
          ret = await getListDetail({ id: search, source, page: 1, isRefresh: true })
          let list = ret.list
          if (list != null && list.length > 0) {
            for (let i = 0; i < list.length; i++) {
              const item = list[i]
              try {
                getOnlineMusicUrl({
                  musicInfo: item,
                  isRefresh: true,
                  allowToggleSource: false,
                })
                await waitSeconds(10)
                // const requestKey = `request__${Math.random().toString().substring(2)}`
                // let type: LX.Quality = '128k'
                // sendRequest({
                //   requestKey,
                //   data: {
                //     source,
                //     action: 'musicUrl',
                //     info: {
                //       type,
                //       musicInfo: item,
                //     },
                //   }
                // })
              } catch (ex) { }
            }
          }
        }
        // musicSdk.kw.songList.
        msg = JSON.stringify({
          data: ret,
        })
      }
        break
      case '/lyric':
        code = 200
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        msg = global.lx.player_status.lyric
        break
      case '/subscribe-player-status':
        try {
          handleSubscribePlayerStatus(req, res, query)
          return
        } catch (err) {
          console.log(err)
          code = 500
          msg = 'Error'
        }
        break
      default:
        code = 401
        msg = 'Forbidden'
        break
    }
    if (!code) return
    res.writeHead(code)
    res.end(msg)
  })
  httpServer.on('error', error => {
    console.log(error)
    reject(error)
  })
  httpServer.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => {
      sockets.delete(socket)
    })
    socket.setTimeout(4000)
  })

  httpServer.on('listening', () => {
    const addr = httpServer.address()
    // console.log(addr)
    if (!addr) {
      reject(new Error('address is null'))
      return
    }
    resolve()
  })
  httpServer.listen(port, ip)
})

const handleStopServer = async() => new Promise<void>((resolve, reject) => {
  if (!httpServer) return
  httpServer.close((err) => {
    if (err) {
      reject(err)
      return
    }
    resolve()
  })
  for (const socket of sockets) socket.destroy()
  sockets.clear()
  responses.clear()
})


const sendStatus = (status: Partial<LX.Player.Status>) => {
  if (!responses.size) return
  for (const [resp, keys] of responses) {
    for (const [k, v] of Object.entries(status)) {
      if (!keys.includes(k as SubscribeKeys)) continue
      resp.write(`event: ${k}\n`)
      resp.write(`data: ${JSON.stringify(v)}\n\n`)
    }
  }
}
export const stopServer = async() => {
  global.lx.event_app.off('player_status', sendStatus)
  if (!status.status) {
    status.status = false
    status.message = ''
    status.address = ''
    return status
  }
  await handleStopServer().then(() => {
    status.status = false
    status.message = ''
    status.address = ''
  }).catch(err => {
    console.log(err)
    status.message = err.message
  })
  return status
}
export const startServer = async(port: number, bindLan: boolean) => {
  if (status.status) await stopServer()
  await handleStartServer(port, bindLan ? '0.0.0.0' : '127.0.0.1').then(() => {
    status.status = true
    status.message = ''
    let address = ['127.0.0.1']
    if (bindLan) address = [...address, ...getAddress()]
    status.address = address.join(', ')
  }).catch(err => {
    console.log(err)
    status.status = false
    status.message = err.message
    status.address = ''
  })
  global.lx.event_app.on('player_status', sendStatus)
  return status
}

export const getStatus = (): LX.OpenAPI.Status => status
