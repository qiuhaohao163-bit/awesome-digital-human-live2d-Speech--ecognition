'use client'

import React, { useState, useEffect, memo, useRef } from "react";
import { useTranslations } from 'next-intl';
import {
    Divider,
    Switch,
    Input,
    Button,
    Chip,
    Autocomplete,
    AutocompleteItem,
    Link,
    Skeleton
} from "@heroui/react";
import { Card, CardBody } from "@heroui/react";
import { 
    api_asr_get_list, 
    api_asr_get_config 
} from '@/lib/api/server';
import { EngineParamDesc, EngineDesc, IFER_TYPE, CHAT_MODE } from '@/lib/protocol';
import { useSentioWakewordStore, useSentioChatModeStore } from "@/lib/store/sentio";
import { InfoTip } from "@/components/tips/info";
import { ParamsLoading, ParamsList } from "./params";
import { createASRWebsocketClient, WS_RECV_ACTION_TYPE, WS_SEND_ACTION_TYPE } from '@/lib/api/websocket';
import { AudioRecoder } from '@/lib/utils/audio';

const EngineSelector = memo(({
    engine,
    engineList,
    onEngineChange
}: {
    engine: string,
    engineList: { [key: string]: EngineDesc },
    onEngineChange: (e: string | null) => void
}) => {
    const contentRender = () => {
        return (
            <div className="flex flex-col gap-1">
                <p className="font-bold">{engineList[engine]?.desc}</p>
                {engineList[engine]?.meta.official && <Link href={engineList[engine].meta.official} isExternal className="text-xs hover:underline">👉 前往官网</Link>}
                {engineList[engine]?.meta.configuration && <Link href={engineList[engine].meta.configuration} isExternal className="text-xs hover:underline">👉 如何配置</Link>}
                {engineList[engine]?.meta.tips && <p className="text-xs text-yellow-500">{`Tips: ${engineList[engine].meta.tips}`}</p>}
            </div>
        )
    }
    return (
        <div className="flex flex-row gap-2">
            <Autocomplete
                className="max-w-xs"
                color="warning"
                aria-label='engineSelect'
                key="engineSelect"
                name="engineSelect"
                selectedKey={engine}
                onSelectionChange={(e) => onEngineChange(e as string)}
            >
                {
                    Object.values(engineList).map((engine) => (
                        <AutocompleteItem key={engine.name}>{engine.name}</AutocompleteItem>
                    ))
                }
            </Autocomplete>
            <InfoTip content={contentRender()}/>
        </div>
    )
});

const EngineSelectorLoading = () => {
    return (
        <Skeleton className="max-w-xs rounded-lg">
          <div className="h-8 max-w-xs rounded-lg bg-default-300" />
        </Skeleton>
    )
}

export const WakewordTab = memo(() => {
    const t = useTranslations('Products.sentio.settings');
    const t_wakeword = useTranslations('Products.sentio.settings.wakeword');
    const { 
        enable, 
        asrEngine, 
        asrSettings, 
        wakewords,
        isListening,
        lastDetectedText,
        setEnable, 
        setAsrEngine, 
        setAsrSettings,
        setWakewords,
        setIsListening,
        setLastDetectedText
    } = useSentioWakewordStore();
    
    // 导入聊天模式 store
    const { chatMode, setChatMode } = useSentioChatModeStore();

    const [isWakewordDetected, setIsWakewordDetected] = useState(false);
    const [partialText, setPartialText] = useState("");
    const [ isLoadingEngineList, setIsLoadingEngineList ] = useState(true);
    const [ isLoadingEngineParams, setIsLoadingEngineParams ] = useState(true);
    const engineList = useRef<{[key: string]: EngineDesc}>({});
    const engineParams = useRef<EngineParamDesc[]>([]);
    const wakewordClientRef = useRef<any>(null);
    const audioRecorderRef = useRef<AudioRecoder | null>(null);

    const getEngineParams = (engine: string) => {
        api_asr_get_config(engine).then((params) => {
            let newSettings: { [key: string]: any } = {};
            for (var id in params) {
                let param = params[id];
                newSettings[param.name] = param.default;
            }
            if (Object.keys(asrSettings).length != params.length) {
                setAsrSettings(newSettings);
            }
            if (Object.keys(newSettings).length > 0) {
                for (var id in params) {
                    let param = params[id];
                    if (param.name in asrSettings) {
                        param.default = asrSettings[param.name];
                    }
                }
            }
            engineParams.current = params;
            setIsLoadingEngineParams(false);
        })
    };

    const onEngineChange = (e: string | null) => {
        if (e == null) return;
        if (isListening) {
            alert("请先停止监听再切换引擎");
            return;
        }
        setIsLoadingEngineParams(true);
        engineParams.current = [];
        setAsrEngine(e);
        getEngineParams(e);
    };

    useEffect(() => {
        api_asr_get_list().then((engines: EngineDesc[]) => {
            const streamEngines = engines.filter(engine => engine.infer_type === IFER_TYPE.STREAM);
            engineList.current = streamEngines.reduce((el: { [key: string]: EngineDesc }, engine) => {
                el[engine.name] = engine;
                return el;
            }, {});
            
            setIsLoadingEngineList(false);

            const names = streamEngines.map((engine) => engine.name);
            if (names.includes(asrEngine)) {
                setIsLoadingEngineParams(true);
                engineParams.current = [];
                getEngineParams(asrEngine);
            } else if (streamEngines.length > 0) {
                onEngineChange(streamEngines[0].name);
            }
        });
    }, []);

    useEffect(() => {
        return () => {
            if (isListening) {
                stopListening();
            }
        };
    }, []);

    const checkWakeword = (text: string): boolean => {
        if (!text || !wakewords) return false;
        const wakewordList = wakewords.split(',').map(w => w.trim()).filter(w => w);
        return wakewordList.some(word => text.includes(word));
    };

    // 唤醒词检测成功后的处理逻辑
    const onWakewordDetected = (detectedText: string) => {
        console.log("✅ 检测到唤醒词:", detectedText);
        
        // 1. 设置检测到状态
        setIsWakewordDetected(true);
        setLastDetectedText(detectedText);
        
        // 2. 切换到沉浸模式（对话模式）
        if (chatMode !== CHAT_MODE.IMMSERSIVE) {
            console.log("切换到沉浸模式");
            setChatMode(CHAT_MODE.IMMSERSIVE);
        }
        
        // 3. 停止唤醒词监听（可选，如果你希望唤醒后继续监听则注释掉）
        // setTimeout(() => {
        //     stopListening();
        // }, 1000);
        
        // 4. 3秒后恢复状态
        setTimeout(() => setIsWakewordDetected(false), 3000);
        
        // 5. 可以在这里添加语音提示反馈（可选）
        // 例如: 播放一个提示音或语音 "我在"、"有什么可以帮您" 等
    };

    const startListening = async () => {
        try {
            if (!asrEngine || !engineList.current[asrEngine]) {
                alert("请先选择 ASR 引擎");
                return;
            }

            wakewordClientRef.current = createASRWebsocketClient({
                engine: asrEngine,
                config: asrSettings,
                onMessage: (action, data) => {
                    const decoder = new TextDecoder();
                    
                    if (action === WS_RECV_ACTION_TYPE.ENGINE_PARTIAL_OUTPUT) {
                        const text = decoder.decode(data);
                        setPartialText(text);
                        
                        if (checkWakeword(text)) {
                            onWakewordDetected(text);
                        }
                    } else if (action === WS_RECV_ACTION_TYPE.ENGINE_FINAL_OUTPUT) {
                        const finalText = decoder.decode(data);
                        setLastDetectedText(finalText);
                        setPartialText("");
                        
                        if (checkWakeword(finalText)) {
                            onWakewordDetected(finalText);
                        }
                    } else if (action === WS_RECV_ACTION_TYPE.ERROR) {
                        const errorMsg = decoder.decode(data);
                        console.error("唤醒词检测错误:", errorMsg);
                        alert(`识别错误: ${errorMsg}`);
                        stopListening();
                    }
                },
                onOpen: () => console.log("唤醒词检测已连接"),
                onClose: () => {
                    if (isListening) {
                        setIsListening(false);
                        setPartialText("");
                    }
                },
                onError: (error) => {
                    console.error("唤醒词检测错误:", error);
                    alert("连接失败，请检查引擎配置");
                    stopListening();
                }
            });
            
            wakewordClientRef.current.connect();
            
            audioRecorderRef.current = new AudioRecoder(
                16000, 1, 1024,
                (chunk: Uint8Array) => {
                    wakewordClientRef.current?.sendMessage(WS_SEND_ACTION_TYPE.ENGINE_PARTIAL_INPUT, chunk);
                }
            );
            
            await audioRecorderRef.current.start();
            setIsListening(true);
            
        } catch (error) {
            console.error("启动失败:", error);
            stopListening();
        }
    };

    const stopListening = () => {
        if (audioRecorderRef.current) {
            audioRecorderRef.current.stop();
            audioRecorderRef.current = null;
        }
        
        if (wakewordClientRef.current) {
            wakewordClientRef.current.sendMessage(WS_SEND_ACTION_TYPE.ENGINE_STOP);
            wakewordClientRef.current.disconnect();
            wakewordClientRef.current = null;
        }
        
        setIsListening(false);
        setPartialText("");
    };

    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    return (
        <Card>
            <CardBody className="p-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4">
                        <Switch isSelected={enable} color="primary" onValueChange={setEnable}>{t('switch')}</Switch>
                        <Divider />
                    </div>
                    {
                        enable &&
                        <>
                            <div className="flex flex-col gap-1">
                                <p className="m-2 text-lg">{t('selectEngine')}</p>
                                {
                                    isLoadingEngineList? 
                                    <EngineSelectorLoading /> 
                                    : 
                                    <EngineSelector 
                                        engine={asrEngine}
                                        engineList={engineList.current}
                                        onEngineChange={onEngineChange}
                                    />
                                }
                            </div>
                            
                            <div className="flex flex-col gap-1 w-full">
                                <p className="m-2 text-lg">{t('engineConfig')}</p>
                                <div className="flex flex-col gap-1">
                                    {
                                        isLoadingEngineParams?
                                        <ParamsLoading />
                                        :
                                        <ParamsList params={engineParams.current} settings={asrSettings} setSettings={setAsrSettings}/>
                                    }
                                </div>
                            </div>

                            <Divider />

                            <div className="flex flex-col gap-1 w-full">
                                <p className="m-2 text-lg">{t_wakeword('wakewordConfig')}</p>
                                <Input
                                    className="max-w-md"
                                    label={t_wakeword('wakewords')}
                                    placeholder={t_wakeword('wakeworksPlaceholder')}
                                    value={wakewords}
                                    onValueChange={setWakewords}
                                    description={t_wakeword('wakeworksDescription')}
                                    disabled={isListening}
                                />
                            </div>

                            <Divider />

                            <div className="flex flex-col gap-3">
                                <p className="m-2 text-lg">{t_wakeword('control')}</p>
                                <div className="flex flex-col gap-2">
                                    <Button
                                        color={isListening ? "danger" : "primary"}
                                        onClick={toggleListening}
                                        className="max-w-md"
                                        isDisabled={!asrEngine}
                                    >
                                        {isListening ? t_wakeword('stopListening') : t_wakeword('startListening')}
                                    </Button>
                                    
                                    <div className="flex flex-col gap-2 p-3 bg-default-100 rounded-lg max-w-md">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{t_wakeword('status')}:</span>
                                            <Chip 
                                                color={isWakewordDetected ? "success" : (isListening ? "primary" : "default")}
                                                variant="flat"
                                                size="sm"
                                            >
                                                {isWakewordDetected ? t_wakeword('wakewordDetected') : (isListening ? t_wakeword('listening') : t_wakeword('stopped'))}
                                            </Chip>
                                        </div>
                                        
                                        {partialText && (
                                            <div className="text-sm">
                                                <span className="font-medium">{t_wakeword('recognizing')}: </span>
                                                <span className="text-default-600">{partialText}</span>
                                            </div>
                                        )}
                                        
                                        {lastDetectedText && (
                                            <div className="text-sm">
                                                <span className="font-medium">{t_wakeword('lastDetected')}: </span>
                                                <span className={isWakewordDetected ? "text-success" : "text-default-600"}>
                                                    {lastDetectedText}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <Divider />

                            <div className="flex flex-col gap-2 p-3 bg-warning-50 rounded-lg max-w-md">
                                <p className="text-sm font-medium text-warning-700">{t_wakeword('tips')}</p>
                                <ul className="text-xs text-warning-600 list-disc list-inside space-y-1">
                                    <li>{t_wakeword('tip1')}</li>
                                    <li>{t_wakeword('tip2')}</li>
                                    <li>{t_wakeword('tip3')}</li>
                                    <li>{t_wakeword('tip4')}</li>
                                </ul>
                            </div>
                        </>
                    }
                </div>
            </CardBody>
        </Card>
    )
});

WakewordTab.displayName = 'WakewordTab';
