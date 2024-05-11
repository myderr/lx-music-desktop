// const path = require('path')
import { app } from 'electron'
import { mainHandle, mainOn, mainOnce } from '@common/mainIpc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
// import { name as defaultName } from '../../../../../package.json'
import {
  minimize,
  maximize,
  closeWindow,
  showWindow,
  setFullScreen,
  sendEvent,
  clearCache,
  getCacheSize,
  toggleDevTools,
  setWindowBounds,
  setIgnoreMouseEvents,
  // setThumbnailClip,
  toggleMinimize,
  toggleHide,
  showSelectDialog,
  showDialog,
  showSaveDialog,
} from '@main/modules/winMain'
import { quitApp } from '@main/app'
import { getAllThemes, removeTheme, saveTheme, setPowerSaveBlocker } from '@main/utils'
import { openDirInExplorer } from '@common/utils/electron'
// import { ListDetailInfo } from '@/renderer/store/songList/state'

interface ListDetailInfo {
  list: LX.Music.MusicInfoOnline[]
  source: LX.OnlineSource
  desc: string | null
  total: number
  page: number
  limit: number
  key: string | null
  id: string
  info: {
    name?: string
    img?: string
    desc?: string
    author?: string
    play_count?: string
  }
  noItemLabel: string
}

export default () => {
  // 设置应用名称
  // mainOn(WIN_MAIN_RENDERER_EVENT_NAME.set_app_name, ({ params: name }) => {
  //   if (name == null) {
  //     app.setName(defaultName)
  //   } else {
  //     app.setName(name)
  //   }
  // })
  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.quit, () => {
    quitApp()
  })
  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.min_toggle, () => {
    toggleMinimize()
  })
  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.hide_toggle, () => {
    toggleHide()
  })
  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.min, () => {
    minimize()
  })
  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.max, () => {
    maximize()
  })
  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.focus, () => {
    showWindow()
  })
  mainOn<boolean>(WIN_MAIN_RENDERER_EVENT_NAME.set_power_save_blocker, ({ params: enabled }) => {
    setPowerSaveBlocker(enabled)
  })
  mainOn<boolean>(WIN_MAIN_RENDERER_EVENT_NAME.close, ({ params: isForce }) => {
    if (isForce) {
      app.exit(0)
      return
    }
    global.lx.isTrafficLightClose = true
    closeWindow()
  })
  // 全屏
  mainHandle<boolean, boolean>(WIN_MAIN_RENDERER_EVENT_NAME.fullscreen, async({ params: isFullscreen }) => {
    global.lx.event_app.main_window_fullscreen(isFullscreen)
    return setFullScreen(isFullscreen)
  })

  // 选择目录
  mainHandle<Electron.OpenDialogOptions, Electron.OpenDialogReturnValue>(WIN_MAIN_RENDERER_EVENT_NAME.show_select_dialog, async({ params: options }) => {
    return showSelectDialog(options)
  })
  // 显示弹窗信息
  mainOn<Electron.MessageBoxSyncOptions>(WIN_MAIN_RENDERER_EVENT_NAME.show_dialog, ({ params }) => {
    showDialog(params)
  })
  // 显示保存弹窗
  mainHandle<Electron.SaveDialogOptions, Electron.SaveDialogReturnValue>(WIN_MAIN_RENDERER_EVENT_NAME.show_save_dialog, async({ params }) => {
    return showSaveDialog(params)
  })
  // 在资源管理器中定位文件
  mainOn<string>(WIN_MAIN_RENDERER_EVENT_NAME.open_dir_in_explorer, async({ params }) => {
    return openDirInExplorer(params)
  })


  mainHandle(WIN_MAIN_RENDERER_EVENT_NAME.clear_cache, async() => {
    await clearCache()
  })

  mainHandle<number>(WIN_MAIN_RENDERER_EVENT_NAME.get_cache_size, async() => {
    return getCacheSize()
  })

  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.open_dev_tools, () => {
    toggleDevTools()
  })

  mainOn<Partial<Electron.Rectangle>>(WIN_MAIN_RENDERER_EVENT_NAME.set_window_size, ({ params }) => {
    setWindowBounds(params)
  })

  mainOn<boolean>(WIN_MAIN_RENDERER_EVENT_NAME.set_ignore_mouse_events, ({ params: isIgnored }) => {
    isIgnored
      ? setIgnoreMouseEvents(isIgnored, { forward: true })
      : setIgnoreMouseEvents(false)
  })

  // mainHandle<Electron.Rectangle>(WIN_MAIN_RENDERER_EVENT_NAME.taskbar_set_thumbnail_clip, async({ params }) => {
  //   return setThumbnailClip(params)
  // })

  mainOn<LX.Player.Status>(WIN_MAIN_RENDERER_EVENT_NAME.player_status, ({ params }) => {
    // setThumbarButtons(params)
    global.lx.event_app.player_status(params)
  })

  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.inited, () => {
    global.lx.event_app.main_window_inited()
  })

  mainHandle<{ themes: LX.Theme[], userThemes: LX.Theme[] }>(WIN_MAIN_RENDERER_EVENT_NAME.get_themes, async() => {
    return getAllThemes()
  })
  mainHandle<LX.Theme>(WIN_MAIN_RENDERER_EVENT_NAME.save_theme, async({ params: theme }) => {
    saveTheme(theme)
  })
  mainHandle<string>(WIN_MAIN_RENDERER_EVENT_NAME.remove_theme, async({ params: id }) => {
    removeTheme(id)
  })
}

export const sendFocus = () => {
  sendEvent(WIN_MAIN_RENDERER_EVENT_NAME.focus)
}

export const sendTaskbarButtonClick = (action: LX.Player.StatusButtonActions) => {
  sendEvent(WIN_MAIN_RENDERER_EVENT_NAME.player_action_on_button_click, action)
}
export const sendConfigChange = (setting: Partial<LX.AppSetting>) => {
  sendEvent(WIN_MAIN_RENDERER_EVENT_NAME.on_config_change, setting)
}

interface ListDetailPara { id: string, source: LX.OnlineSource, page: number, isRefresh: boolean }

export const getListDetail = async(input: ListDetailPara): Promise<ListDetailInfo> => {
  return new Promise((resolve, reject) => {
    mainOnce<ListDetailInfo>(WIN_MAIN_RENDERER_EVENT_NAME.send_list_detail, ({ params: data }) => {
      resolve(data)
    })
    sendEvent<ListDetailPara>(WIN_MAIN_RENDERER_EVENT_NAME.get_list_detail, input)
  })
}

interface MusicUrlPara {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource?: boolean
}
export const getOnlineMusicUrl = (input: MusicUrlPara) => {
  sendEvent<MusicUrlPara>(WIN_MAIN_RENDERER_EVENT_NAME.get_online_music_url, input)
  // return new Promise((resolve, reject) => {
  //   mainOnce<string>(WIN_MAIN_RENDERER_EVENT_NAME.send_online_music_url, ({ params: data }) => {
  //     resolve(data)
  //   })
  //   sendEvent<MusicUrlPara>(WIN_MAIN_RENDERER_EVENT_NAME.get_online_music_url, input)
  // });
}
