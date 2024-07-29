import * as React from 'react';
import { message } from 'antd';
import Home from './Home';
import 'antd/lib/message/style/css';

const App = () => {
  const [ langProps, setLangProps ] = React.useState({});
  
  React.useEffect(() => {
    window.addEventListener('message', (event: any) => {
      handleMessagesFromExtension(event);
    });

    postReadyMessage();

    return () => {
      window.removeEventListener('message', handleMessagesFromExtension);
    };
  }, []);

  const handleMessagesFromExtension = (event: any) => {
    const { data } = event || {};
    console.log("handleMessagesFromExtension data", data)
    if (data.type === 'TRANSLATE-POST') {
      if (data.payload) {
        setLangProps({ ...data.payload });
      }
    } else if (data.type === 'TRANSLATE-SHOWMSG') {
      if (data.payload) {
        message.success('操作成功');
      } else {
        message.error('操作失败');
      }
    }
  };

  const handleTranslateCB = (data: any) => {
    // vscode已在html中全局注册
    // @ts-ignore
    vscode.postMessage({
      type: 'TRANSLATE-WRITE',
      payload: data,
    });
  }

  const postReadyMessage = () => {
    // @ts-ignore
    vscode.postMessage({
      type: 'READY',
      payload: true,
    });
  }

  return (
    <div>
      <Home { ...langProps} handleCB={handleTranslateCB}></Home>
    </div>
  );
};

export default App;