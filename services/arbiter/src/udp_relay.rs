//! One bounded UDP/WebSocket relay, with no detached receiver task.
use futures::{Sink, SinkExt, Stream, StreamExt};
use rocket_ws::Message;
use std::fmt::Display;
use tokio::net::UdpSocket;

#[derive(Debug, PartialEq)]
pub enum RelayExit {
    WebSocketEnded,
    WebSocketClosed,
    WebSocketError(String),
    UdpError(String),
    DatagramTooLarge,
}

pub async fn forward<S, E>(mut stream: S, socket: UdpSocket) -> RelayExit
where
    S: Stream<Item = Result<Message, E>> + Sink<Message> + Unpin,
    E: Display,
    <S as Sink<Message>>::Error: Display,
{
    // A full IPv4 UDP datagram must fit without silent truncation. Socket
    // buffers and awaiting each send provide bounded backpressure.
    let mut buffer = [0u8; 65536];
    loop {
        tokio::select! {
            packet = socket.recv(&mut buffer) => {
                match packet {
                    Ok(length) => {
                        if let Err(error) = stream.send(Message::Binary(buffer[..length].to_vec())).await {
                            return RelayExit::WebSocketError(error.to_string());
                        }
                    }
                    Err(error) => return RelayExit::UdpError(error.to_string()),
                }
            }
            message = stream.next() => {
                match message {
                    Some(Ok(Message::Binary(bytes))) => {
                        if bytes.len() > 65507 { return RelayExit::DatagramTooLarge; }
                        if let Err(error) = socket.send(&bytes).await {
                            return RelayExit::UdpError(error.to_string());
                        }
                    }
                    Some(Ok(Message::Close(_))) => return RelayExit::WebSocketClosed,
                    Some(Ok(_)) => {}, // WebSocket implementation handles control frames.
                    Some(Err(error)) => return RelayExit::WebSocketError(error.to_string()),
                    None => return RelayExit::WebSocketEnded,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::channel::mpsc;
    use std::{
        io,
        pin::Pin,
        task::{Context, Poll},
        time::Duration,
    };

    struct TestSocket {
        incoming: mpsc::UnboundedReceiver<Result<Message, io::Error>>,
        outgoing: mpsc::UnboundedSender<Message>,
    }
    impl Stream for TestSocket {
        type Item = Result<Message, io::Error>;
        fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
            Pin::new(&mut self.incoming).poll_next(cx)
        }
    }
    impl Sink<Message> for TestSocket {
        type Error = mpsc::SendError;
        fn poll_ready(
            mut self: Pin<&mut Self>,
            cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Pin::new(&mut self.outgoing).poll_ready(cx)
        }
        fn start_send(mut self: Pin<&mut Self>, item: Message) -> Result<(), Self::Error> {
            Pin::new(&mut self.outgoing).start_send(item)
        }
        fn poll_flush(
            mut self: Pin<&mut Self>,
            cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Pin::new(&mut self.outgoing).poll_flush(cx)
        }
        fn poll_close(
            mut self: Pin<&mut Self>,
            cx: &mut Context<'_>,
        ) -> Poll<Result<(), Self::Error>> {
            Pin::new(&mut self.outgoing).poll_close(cx)
        }
    }

    #[rocket::async_test]
    async fn preserves_large_datagrams_and_releases_socket_when_websocket_ends() {
        let peer = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let socket = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let address = socket.local_addr().unwrap();
        socket.connect(peer.local_addr().unwrap()).await.unwrap();
        let (input, incoming) = mpsc::unbounded();
        let (outgoing, mut output) = mpsc::unbounded();
        let relay = tokio::spawn(forward(TestSocket { incoming, outgoing }, socket));
        let payload = vec![42u8; 4096];
        input
            .unbounded_send(Ok(Message::Binary(payload.clone())))
            .unwrap();
        let mut buffer = vec![0; 65536];
        let (size, sender) =
            tokio::time::timeout(Duration::from_secs(2), peer.recv_from(&mut buffer))
                .await
                .unwrap()
                .unwrap();
        assert_eq!(&buffer[..size], payload.as_slice());
        let foreign = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        foreign.send_to(&vec![99; 4096], address).await.unwrap();
        peer.send_to(&payload, sender).await.unwrap();
        let reply = tokio::time::timeout(Duration::from_secs(2), output.next())
            .await
            .unwrap()
            .unwrap();
        assert_eq!(reply, Message::Binary(payload));
        drop(input);
        let exit = tokio::time::timeout(Duration::from_secs(2), relay)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(exit, RelayExit::WebSocketEnded);
        assert!(
            UdpSocket::bind(address).await.is_ok(),
            "Relay leaked its UDP socket after EOF"
        );
    }

    #[rocket::async_test]
    async fn rejects_oversized_websocket_datagrams() {
        let socket = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        socket.connect("127.0.0.1:9").await.unwrap();
        let (input, incoming) = mpsc::unbounded();
        let (outgoing, _output) = mpsc::unbounded();
        input
            .unbounded_send(Ok(Message::Binary(vec![0; 65508])))
            .unwrap();
        let exit = tokio::time::timeout(
            Duration::from_secs(2),
            forward(TestSocket { incoming, outgoing }, socket),
        )
        .await
        .unwrap();
        assert_eq!(exit, RelayExit::DatagramTooLarge);
    }
}
