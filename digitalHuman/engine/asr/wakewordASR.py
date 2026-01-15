# -*- coding: utf-8 -*-
'''
@File    :   wakewordASR.py
@Author  :   一力辉
@Desc    :   唤醒词检测引擎 - 基于FunASR流式识别实现唤醒词检测
'''

import json
import asyncio
import websockets
from typing import List, Set
from fastapi import WebSocket, WebSocketDisconnect
from digitalHuman.utils import logger
from digitalHuman.engine.builder import ASREngines
from digitalHuman.protocol import *
from digitalHuman.engine.engineBase import StreamBaseEngine

__all__ = ["WakewordASR"]


@ASREngines.register("wakeword")
class WakewordASR(StreamBaseEngine):
    """
    唤醒词检测引擎
    基于FunASR流式识别，实时检测音频中的唤醒词
    当检测到唤醒词时，向客户端发送唤醒事件
    """
    
    def setup(self):
        """初始化唤醒词列表"""
        super().setup()
        # 从配置中获取唤醒词列表
        custom_config = self.custom()
        wakewords_str = custom_config.get("wakewords", "")
        # 将逗号分隔的字符串转换为集合，并去除空格
        self.wakewords: Set[str] = set(
            word.strip() for word in wakewords_str.split(",") if word.strip()
        )
        logger.info(f"[WakewordASR] 已加载唤醒词: {self.wakewords}")
    
    def _check_wakeword(self, text: str) -> bool:
        """
        检查文本中是否包含唤醒词
        
        Args:
            text: 识别的文本
            
        Returns:
            bool: 是否检测到唤醒词
        """
        if not text:
            return False
        
        # 检查是否包含任意一个唤醒词
        for wakeword in self.wakewords:
            if wakeword in text:
                logger.info(f"[WakewordASR] 检测到唤醒词: {wakeword} in '{text}'")
                return True
        return False
    
    async def _reset_sentence(self, funasrWebsocket: websockets.ClientConnection):
        """重置说话识别, 防止连续识别添加标点符号"""
        message = json.dumps({"is_speaking": False})
        await funasrWebsocket.send(message)
        message = json.dumps({"is_speaking": True})
        await funasrWebsocket.send(message)
    
    async def _task_send(self, adhWebsocket: WebSocket, funasrWebsocket: websockets.ClientConnection):
        """
        funasr server -> adh server -> adh web
        处理来自FunASR的识别结果，检测唤醒词
        """
        text_send = ""
        text_send_2pass_online = ""
        text_send_2pass_offline = ""
        wakeword_detected = False
        
        try:
            while True:
                meg = await funasrWebsocket.recv()
                meg = json.loads(meg)
                text = meg["text"]
                offline_msg_done = meg.get("is_final", False)
                
                if "mode" not in meg:
                    continue
                
                # 根据识别模式处理文本
                if meg["mode"] == "online":
                    text_send += text
                elif meg["mode"] == "offline":
                    text_send += text
                    offline_msg_done = True
                else:
                    if meg["mode"] == "2pass-online":
                        text_send_2pass_online += text
                        text_send = text_send_2pass_offline + text_send_2pass_online
                    else:
                        offline_msg_done = True
                        text_send_2pass_online = ""
                        text_send = text_send_2pass_offline + text
                        text_send_2pass_offline += text
                
                # 检测唤醒词（在部分结果和最终结果中都检测）
                if self._check_wakeword(text_send):
                    wakeword_detected = True
                    # 发送唤醒词检测事件（使用自定义action）
                    await WebSocketHandler.send_message(
                        adhWebsocket, 
                        "WAKEWORD_DETECTED",  # 自定义action
                        json.dumps({
                            "text": text_send,
                            "wakeword": True
                        })
                    )
                
                # 发送识别结果
                if offline_msg_done:
                    await WebSocketHandler.send_message(
                        adhWebsocket, 
                        WS_SEND_ACTION_TYPE.ENGINE_FINAL_OUTPUT, 
                        text_send
                    )
                    
                    # 如果检测到唤醒词，日志记录
                    if wakeword_detected:
                        logger.info(f"[WakewordASR] 唤醒词识别完成: '{text_send}'")
                        wakeword_detected = False
                    
                    # 重置状态
                    text_send = ""
                    text_send_2pass_online = ""
                    text_send_2pass_offline = ""
                    await self._reset_sentence(funasrWebsocket)
                else:
                    await WebSocketHandler.send_message(
                        adhWebsocket, 
                        WS_SEND_ACTION_TYPE.ENGINE_PARTIAL_OUTPUT, 
                        text_send
                    )
                    
        except WebSocketDisconnect:
            logger.debug("[WakewordASR] adhWebsocket closed, task_send exit")
        except websockets.ConnectionClosed:
            logger.debug("[WakewordASR] funasrWebsocket closed, task_send exit")
        except Exception as e:
            logger.error(f"[WakewordASR] task_send error: {e}")
            await WebSocketHandler.send_message(adhWebsocket, WS_SEND_ACTION_TYPE.ERROR, str(e))
    
    async def _task_recv(self, adhWebsocket: WebSocket, funasrWebsocket: websockets.ClientConnection, mode: str, hotwords: str):
        """
        adh web -> adh server -> funasr server
        处理来自客户端的音频数据
        """
        try:
            # 发送初始化配置，包含热词
            message = json.dumps({
                "mode": mode,
                "chunk_size": [5, 10, 5],  # chunk_size: 60 * 10 ms
                "chunk_interval": 10,
                "encoder_chunk_look_back": 4,
                "decoder_chunk_look_back": 0,
                "wav_name": "wakeword",
                "is_speaking": True,
                "hotwords": hotwords,  # 热词可以提高唤醒词识别准确率
                "itn": True,
            })
            await funasrWebsocket.send(message)
            await WebSocketHandler.send_message(adhWebsocket, WS_SEND_ACTION_TYPE.ENGINE_STARTED)
            
            # 处理音频流
            while True:
                action, payload = await WebSocketHandler.recv_message(adhWebsocket)
                match action:
                    case WS_RECV_ACTION_TYPE.PING:
                        await WebSocketHandler.send_message(adhWebsocket, WS_SEND_ACTION_TYPE.PONG, b"")
                    case WS_RECV_ACTION_TYPE.ENGINE_START:
                        raise RuntimeError("WakewordASR has been started")
                    case WS_RECV_ACTION_TYPE.ENGINE_PARTIAL_INPUT:
                        await funasrWebsocket.send(payload)
                    case WS_RECV_ACTION_TYPE.ENGINE_FINAL_INPUT:
                        message = json.dumps({"is_speaking": False})
                        await funasrWebsocket.send(message)
                        await funasrWebsocket.send(payload)
                    case WS_RECV_ACTION_TYPE.ENGINE_STOP:
                        await funasrWebsocket.close()
                        await WebSocketHandler.send_message(adhWebsocket, WS_SEND_ACTION_TYPE.ENGINE_STOPPED)
                        return
                    case _:
                        raise RuntimeError(f"WakewordASR task_recv error: {action} not found")
                        
        except WebSocketDisconnect:
            logger.debug("[WakewordASR] adhWebsocket closed, task_recv exit")
        except Exception as e:
            logger.error(f"[WakewordASR] task_recv error: {e}")
            await WebSocketHandler.send_message(adhWebsocket, WS_SEND_ACTION_TYPE.ERROR, str(e))
    
    async def run(self, websocket: WebSocket, **kwargs) -> None:
        """
        运行唤醒词检测引擎
        
        Args:
            websocket: FastAPI WebSocket连接
            **kwargs: 参数配置
                - api_url: FunASR服务地址
                - mode: 识别模式 (2pass推荐)
                - wakewords: 唤醒词列表（逗号分隔）
                - sensitivity: 检测灵敏度（0.0-1.0，预留参数）
        """
        # 参数校验
        parameters = self.checkParameter(**kwargs)
        API_URL = parameters["api_url"]
        MODE = parameters["mode"]
        
        # 可选：从运行时参数更新唤醒词（优先级高于配置文件）
        if "wakewords" in parameters and parameters["wakewords"]:
            wakewords_str = parameters["wakewords"]
            self.wakewords = set(
                word.strip() for word in wakewords_str.split(",") if word.strip()
            )
            logger.info(f"[WakewordASR] 运行时更新唤醒词: {self.wakewords}")
        
        # 准备热词字符串（用于FunASR热词功能，提高识别准确率）
        hotwords = " ".join(self.wakewords) if self.wakewords else ""
        
        await WebSocketHandler.send_message(websocket, WS_SEND_ACTION_TYPE.ENGINE_INITIALZING)
        
        # 连接FunASR服务器
        try:
            async with websockets.connect(API_URL, subprotocols=["binary"], ping_interval=None) as funasrWebsocket:
                # 创建双向数据流任务
                task_recv = asyncio.create_task(
                    self._task_recv(websocket, funasrWebsocket, MODE, hotwords)
                )
                task_send = asyncio.create_task(
                    self._task_send(websocket, funasrWebsocket)
                )
                
                # 等待任务完成
                await asyncio.gather(task_recv, task_send)
                
        except Exception as e:
            logger.error(f"[WakewordASR] 连接FunASR失败: {e}")
            await WebSocketHandler.send_message(
                websocket, 
                WS_SEND_ACTION_TYPE.ERROR, 
                f"无法连接到FunASR服务: {str(e)}"
            )
