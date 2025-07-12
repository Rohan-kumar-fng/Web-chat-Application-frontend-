import React, {useEffect, useState } from "react"
import { over } from "stompjs"
import SockJS from "sockjs-client/dist/sockjs"

var stompClient: any = null

const MessageArea = () => {
    const [privateMessage, setPrivateMessage] = useState(new Map());
    const [publicMessage, setPublicMessage] = useState([]);
    const [chatArea, setChatArea] = useState("PUBLIC");
    const [userData, setUserData ] = useState({
        username: "",
        receivername: "",
        message: "",
        connected: false,
    });

    const registerUser = () => {
        connect(); // Create the connection using the stomp=clinet over Websocket
    }
    
    const connect = () => {
        // to connect you need to setup new SockJS URL which clinet need to sedn HTTP in order to connect to stomp
        let sock = new SockJS("http://localhost:8080/chat");
    
        // Instantiate the sompClinet
        stompClient = over(sock);
    
        // Finally connect using stomp
        stompClient.connect({}, onConnected, onError);
        console.log("STOMP Get connected");
    }
    
    // handle on connection success
    // subscribe to the different channels available on the backend (Login is implemented on the backed)
    const onConnected = () => {
        // update that the user is connected
        console.log("Update the user Information");
        setUserData({...userData, connected: true}); // I think this is used for appending the value of connected
    
        // Now based on this used I ned to subscribed to public channel is user opt for ppublic channel
        stompClient.subscribe("/chatroom/public", onPublicMessageReceived);
        stompClient.subscribe("/user/" + userData.username + "/private", onPrivateMessageReceived); // So the user is subscribed to both public and private link
    
        // This joins a new user to some private user with status JOIN
        userJoin();
    };
    
    const onError = (error: any) => {
        console.log(error);
    };
    
    // perform some buisness logic after receiving the message
    const onPublicMessageReceived = (payload: any) => {
        console.log(payload);
        var payloadData=JSON.parse(payload.body);
        console.log(payloadData.status);
        switch(payloadData.status){
            // if the user is joining for the first time
            // with the status join createa private chat map (first time only)
            case "JOIN":
                if(!privateMessage.get(payloadData.from)) {
                    privateMessage.set(payloadData.from,[]);
                    setPrivateMessage(new Map(privateMessage));
                }
                break;
            case "MESSAGE":
                publicMessage.push(payloadData);
                setPublicMessage([...publicMessage]);
                break;
            case null:
                console.log("Status is still fucking NULL");
            
        } 
    };
    
    // on private message get the payload on subscription to a particular channel
    const onPrivateMessageReceived = (payload: any) => {
        var payloadData = JSON.parse(payload.body);
        // if sender does not exist in the provate
        // message map createa new map pf the user
        // with empty array for private messages
        if(!privateMessage.get(payloadData.from)){
            privateMessage.set(payloadData.from, []);
        }
        // update the private message
        privateMessage.get(payloadData.from).push(payloadData);
        setPrivateMessage(new Map(privateMessage));
    }
    
    // This handle the first user message on join
    // it sends the user details to general publlic (Maybe for joinign public chat)
    const userJoin = () => {
        var chatMessage = {
            from: userData.username,
            status: "JOIN",
        }
        stompClient.send("/app/message",{},JSON.stringify(chatMessage));
    };
    
    const sendPublicMessage = () => {
        // if clinet is indeed connected
        if(stompClient){
            let chatMessage ={
                from: userData.username,
                content: userData.message,
                status: "MESSAGE"
            };
            // sednt eh user details to the message controller
            stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
            // update the user message to empty string (Why??)
            setUserData({ ...userData, message: "" });
        }
    }
    
    const sendPrivateMessage = () => {
        // check user is connected
        if(stompClient){
            // set the user details including the mesage and the receiver
            let chatMessage ={
                from: userData.username,
                receiverName: chatArea, // (How??)
                content: userData.message,
                status: "MESSAGE"
            };
            if(!privateMessage.get(chatArea)){
                privateMessage.set(chatArea, []);
            }
    
            // finally updat ethe receiver private message anyway
            privateMessage.get(chatArea).push(chatMessage);
            setPrivateMessage(new Map(privateMessage));
    
            // update the user message to empty string
            stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));
            setUserData({...userData, message: ""});
    
        }
    }
    
    const handleMessageInput = (event: any) => {
        console.log(event);
        const { value } = event.target; // I think it pick from the HTML frontend
        console.log(value);
        setUserData({...userData, message: value});
    }
    
    const handleUsernameInput = (event: any) => {
        const { value } = event.target;
        setUserData({...userData, username: value});
    }

  return (
    <div className="container">
      {userData.connected ? (
        //if the user is connected display this
        <div className="chat-box">
          <div className="member-list">
            {/* loop throught the member list */}
            <ul>
              {/* onclick set the tab to the current tab */}
              <li
                onClick={() => {
                  setChatArea("PUBLIC");
                }}
                className={`member ${chatArea === "PUBLIC" && "active"}`}
              >
                PUBLIC CHAT
              </li>
              {/* spreads all the user into an array and then list them out */}
              {[...privateMessage.keys()].map((name, index) => (
                <li
                  onClick={() => {
                    setChatArea(name);
                  }}
                  className={`member ${chatArea === name && "active"}`}
                  key={index}
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
          {chatArea === "PUBLIC" ? (
            <div className="chat-content">
              <ul className="chat-messages">
              
              {
                publicMessage.map((chat, index)=>(
                  <li
                  className={`message ${
                    chat.from === userData.username && "self"
                  }`}
                  key={index}
                  >
                      {chat.from !== userData.username && (
                      <div className="avatar">{chat.from}</div>)}
                      <div className="message-data">{chat.content}</div>
                      {chat.from === userData.username && (
                      <div className="avatar self">{chat.from}</div>
                    )}
                  </li>
                ))
              }

              </ul>

              <div className="send-message">
              <input
                  type="text"
                  className="input-message"
                  placeholder="enter the message"
                  value={userData.message}
                  onChange={handleMessageInput}
                />
                <button
                  type="button"
                  className="send-button"
                  onClick={sendPublicMessage}
                >
                  send
                </button>
              </div>
            </div>
          ) : (
            <div className="chat-content">
              <ul className="chat-messages">
              {
                [...privateMessage.get(chatArea)].map((chat, index)=> (

                  <li
                  className={`message ${
                    chat.from === userData.username && "self"
                  }`}
                  key={index}
                  >
                      {chat.from !== userData.username && (
                      <div className="avatar">{chat.from}</div>)}
                      <div className="message-data">{chat.content}</div>
                      {chat.from === userData.username && (
                      <div className="avatar self">{chat.from}</div>
                    )}
                  </li>
                ))
              }

              </ul>

              <div className="send-message">
              <input
                  type="text"
                  className="input-message"
                  placeholder="enter the message"
                  value={userData.message}
                  onChange={handleMessageInput}
                />
                <button
                  type="button"
                  className="send-button"
                  onClick={sendPrivateMessage}
                >
                  send
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        //if the user is not connected display this
        // this will handle the user login/registration
        <div className="register">
          <input
            id="user-name"
            placeholder="Enter your name"
            name="userName"
            value={userData.username}
            onChange={handleUsernameInput}
            margin="normal"
          />
          <button type="button" onClick={registerUser}>
            connect
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageArea

//  Tehe tutorial is saying that you need below functionality in Frontend side, LEt explore everything
// 1. connect():- I tihnk THis will open the SocketJs client and Websocket server connection
// 2. onconnect():- It passed the payload to others
// 3. onError():- handles the error while connecting with websocket
// 4. onPublicMessageReceived():- REceived payload deom subscriberd brocker handling public message
// 5. onPrivateMessageREceived():- Receiieved payload from subscribed brocker handling private message
// 6. onjoin():- Connect the user to chat platform
// 7. sendPrivateMessage()
// 8. sendPublicMessage()
// 9. handleUserNameInput()
// 10. handleMessageInput()
// 11. registerNewUser()