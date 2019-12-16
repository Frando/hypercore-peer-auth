# hypercore-peer-auth

Authenticate a hypercore-protocol connection by signing the NOISE key pair.

Note: This is quickly written and the crypto needs review. 

See [test.js](./test.js) for an example.

## Example

```javascript

const hyperswarm = require('hyperswarm')
const Protocol = require('hypercore-protocol')
const crypto = require('hypercore-crypto')
const auth = require('.')

// each peer/device has a keypair that is stored (or derived)
// this could also be the keypair from an existing hypercore feed
const IDENTITY = crypto.keyPair()
// console.log('my key', IDENTITY.publicKey.toString('hex'))

// it also maintains a list of the pubkeys of peers it wants to connect with
const ALLOWED_KEYS = []

const swarm = hyperswarm()
swarm.on('connection', onconnection)
function onconnection (socket, details) {
  const isInitiator = !!details.client
  const protocol = new Protocol(!!details.client)

  pump(socket, protocol, socket)

  auth(protocol, {
    authKeyPair: IDENTITY
    onauthenticate (peerAuthKey, cb) {
      for (const key of ALLOWED_KEYS) {
        if (key.equals(peerAuthKey)) return cb(null, true)
      }
      cb(null, false)
    },
    onprotocol (protocol) {
      // if this is called, the peer has proven:
      // - it has the secret key to the peerAuthKey above
      // - the peerAuthKey passed the onauthenticate hook
      // so here you'd start replicating feeds:
      // feed.replicate(isInitiator, { stream: protocol })
    }
  })
}

```
