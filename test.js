const tape = require('tape')
const Protocol = require('hypercore-protocol')
const crypto = require('hypercore-crypto')
const { pipeline } = require('stream')
const authenticatedProtocol = require('.')

tape('basics', t => {
  t.plan(2)
  const auth1 = crypto.keyPair()
  const auth2 = crypto.keyPair()

  const stream1 = init(true, auth1, 'one')
  const stream2 = init(false, auth2, 'two')

  pipeline(stream1, stream2, stream1, (err) => {
    console.log('done', err)
    t.end()
  })

  function init (isInitiator, authKeyPair, name) {
    // console.log(name, 'init', authKeyPair.publicKey.toString('hex'))
    const protocol = new Protocol(isInitiator)
    authenticatedProtocol(protocol, {
      authKeyPair,
      onauthenticate (publicKey, cb) {
        if (name === 'one' && publicKey.equals(auth2.publicKey)) {
          return cb(null, true)
        }
        if (name === 'two' && publicKey.equals(auth1.publicKey)) {
          return cb(null, true)
        }
        cb(null, false)
      },
      onprotocol (protocol) {
        // This is where you'd initialiize the actual connection.
        t.ok(protocol)
      }
    })
    return protocol
  }
})
