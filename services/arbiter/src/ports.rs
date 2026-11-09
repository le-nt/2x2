use crate::{ArbiterError, cfg::STORE};
use rand::Rng;
use std::{
    collections::HashSet,
    net::{TcpListener, UdpSocket},
    sync::{Mutex, OnceLock},
};

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum Transport {
    Tcp,
    Udp,
}

enum BoundPort {
    Tcp { _socket: TcpListener },
    Udp { _socket: UdpSocket },
}
static RESERVED: OnceLock<Mutex<HashSet<(Transport, i32)>>> = OnceLock::new();

pub struct PortLease {
    port: i32,
    transport: Transport,
    bound: Option<BoundPort>,
}
impl PortLease {
    pub fn port(&self) -> i32 {
        self.port
    }
    // Legacy RCC binds its own socket. Retain the logical reservation until
    // startup completes and STORE owns the job, even after releasing the bind.
    pub fn release_bind(&mut self) {
        self.bound.take();
    }
}
impl Drop for PortLease {
    fn drop(&mut self) {
        if let Some(reserved) = RESERVED.get() {
            if let Ok(mut ports) = reserved.lock() {
                ports.remove(&(self.transport, self.port));
            }
        }
    }
}

pub fn reserve(
    start: i32,
    end: i32,
    excluded: i32,
    transport: Transport,
) -> Result<PortLease, ArbiterError> {
    if start < 1 || end > 65535 || start > end {
        return Err(ArbiterError::InvalidPortRange(start, end));
    }
    let mut reserved = RESERVED
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
        .map_err(|_| ArbiterError::InitConfigError("Port reservations unavailable".into()))?;
    let offset = rand::rng().random_range(0..=end - start);
    // Scan without repeated random candidates; bound work for oversized ranges.
    for index in 0..(end - start + 1).min(4096) {
        let port = start + (offset + index) % (end - start + 1);
        if port == excluded || reserved.contains(&(transport, port)) {
            continue;
        }
        let stored = STORE
            .get()
            .map(|store| {
                store
                    .lock()
                    .map(|jobs| {
                        jobs.values().any(|&(game, soap, _)| {
                            port == if transport == Transport::Udp {
                                game
                            } else {
                                soap
                            }
                        })
                    })
                    .unwrap_or(true)
            })
            .unwrap_or(false);
        if stored {
            continue;
        }
        let address = ("127.0.0.1", port as u16);
        let bound = match transport {
            Transport::Tcp => {
                TcpListener::bind(address).map(|socket| BoundPort::Tcp { _socket: socket })
            }
            Transport::Udp => {
                UdpSocket::bind(address).map(|socket| BoundPort::Udp { _socket: socket })
            }
        };
        if let Ok(bound) = bound {
            reserved.insert((transport, port));
            return Ok(PortLease {
                port,
                transport,
                bound: Some(bound),
            });
        }
    }
    Err(ArbiterError::InitConfigError(format!(
        "No available {:?} port in bounded scan of {}..={}",
        transport, start, end
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn checks_the_actual_transport_and_reserves_during_startup() {
        let occupied = UdpSocket::bind("127.0.0.1:0").unwrap();
        let port = i32::from(occupied.local_addr().unwrap().port());
        assert!(reserve(port, port, 0, Transport::Udp).is_err());
        let mut tcp = reserve(port, port, 0, Transport::Tcp).unwrap();
        assert!(TcpListener::bind(("127.0.0.1", port as u16)).is_err());
        tcp.release_bind();
        // The OS bind is released for RCC, but parallel starts still cannot
        // choose this TCP port until the lease is dropped.
        assert!(reserve(port, port, 0, Transport::Tcp).is_err());
        drop(tcp);
        assert!(reserve(port, port, 0, Transport::Tcp).is_ok());
        drop(occupied);
        assert!(reserve(port, port, 0, Transport::Udp).is_ok());
    }
    #[test]
    fn rejects_tcp_conflicts_and_excluded_ports() {
        let occupied = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = i32::from(occupied.local_addr().unwrap().port());
        assert!(reserve(port, port, 0, Transport::Tcp).is_err());
        assert!(reserve(port, port, port, Transport::Udp).is_err());
        assert!(reserve(0, 1, 0, Transport::Udp).is_err());
    }
}
