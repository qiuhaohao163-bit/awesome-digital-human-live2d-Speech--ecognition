# -*- coding: utf-8 -*-
'''
@File    :   difyASR.py
@Author  :   一力辉
'''


from ..builder import ASREngines
from ..engineBase import BaseASREngine
import io, base64
from digitalHuman.protocol import AudioMessage, TextMessage, AUDIO_TYPE
from digitalHuman.utils import logger, httpxAsyncClient, wavToMp3

__all__ = ["DifyApiAsr"]


@ASREngines.register("Dify")
class DifyApiAsr(BaseASREngine):
    async def run(self, input: AudioMessage, **kwargs) -> TextMessage:
        # 参数校验
        paramters = self.checkParameter(**kwargs)
        API_SERVER = paramters["api_server"]
        API_KEY = paramters["api_key"]
        API_USERNAME = paramters["username"]

        headers = {
            'Authorization': f'Bearer {API_KEY}'
        }

        payload = {
            'user': API_USERNAME
        }

        if isinstance(input.data, str):
            input.data = base64.b64decode(input.data)
        if input.type == AUDIO_TYPE.WAV:
            input.data = wavToMp3(input.data)
            input.type = AUDIO_TYPE.MP3
        files = {'file': ('file', io.BytesIO(input.data), 'audio/mp3')}
        upload_response = await httpxAsyncClient.post(API_SERVER + "/files/upload", headers=headers, files=files,
                                               data=payload)
        logger.debug(f"[Dify ASR] 文件上传响应: {upload_response.json()}")

        if upload_response.status_code not in [200, 201]:  # 201 是创建成功的标准状态码
            raise RuntimeError(f"文件上传失败: {upload_response.status_code}, 响应: {upload_response.text}")

        upload_result = upload_response.json()
        file_id = upload_result.get('id')

        if not file_id:
            raise RuntimeError("无法获取文件ID")

        # 第二步：运行工作流,传递文件ID(使用正确的格式)
        # video 字段需要传递文件对象，而不是文件ID
        workflow_payload = {
            'user': API_USERNAME,
            "inputs": {
                "video": {  # 传递文件对象
                    "type": "audio",
                    "transfer_method": "local_file",
                    "upload_file_id": file_id
                }
            },
            "response_mode": "blocking"  # 或 "streaming",根据你的需要
        }

        # 注意：这里需要设置Content-Type为application/json
        workflow_headers = headers.copy()
        workflow_headers['Content-Type'] = 'application/json'
        # response = await httpxAsyncClient.post(API_SERVER + "/audio-to-text", headers=headers, files=files, data=payload)
        logger.debug(f"[Dify ASR] 工作流请求: {API_SERVER}/workflows/run, payload: {workflow_payload}")
        response  = await httpxAsyncClient.post(API_SERVER + "/workflows/run", headers=workflow_headers,
                                                         json=workflow_payload)
        logger.debug(f"[Dify ASR] 工作流响应状态: {response.status_code}")
        logger.debug(f"[Dify ASR] 工作流响应内容: {response.text}")
        if response.status_code != 200:
            raise RuntimeError(f"Dify asr api error: {response.status_code}, 响应: {response.text}")
        
        # 解析响应
        response_data = response.json()
        workflow_status = response_data.get('data', {}).get('status')
        
        # 检查工作流执行状态
        if workflow_status == 'failed':
            error_msg = response_data.get('data', {}).get('error', '未知错误')
            raise RuntimeError(f"Dify 工作流执行失败: {error_msg}")
        
        # 获取输出结果
        outputs = response_data.get('data', {}).get('outputs', {})
        if 'text' not in outputs:
            raise RuntimeError(f"Dify 工作流未返回 text 字段，返回的输出: {outputs}")
        
        result = outputs["text"]
        logger.debug(f"[ASR] Engine response: {result}")
        message = TextMessage(data=result)
        return message

