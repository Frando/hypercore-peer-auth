const tape = require('tape')
const Protocol = require('hypercore-protocol')
const crypto = require('hypercore-crypto')
const { pipeline } = require('stream')
const authenticatedProtocol = require('.')
const hypercore = require('hypercore')
const ram = require('random-access-memory')
const multifeed = require('multifeed')

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

tape('with replication of a hypercore', t => {
  const auth1 = crypto.keyPair()
  const auth2 = crypto.keyPair()

  const feed1 = hypercore(ram)
  feed1.on('ready', () => {
    const feed2 = hypercore(ram, feed1.key)
    feed1.append(Buffer.from('boop'), (err, seq) => {
      t.error(err, 'No error on append')
      const stream1 = init(true, auth1, 'one', feed1)
      const stream2 = init(false, auth2, 'two', feed2)
      stream1.pipe(stream2).pipe(stream1)
      stream1.on('error', (err) => {
        console.log(err)
      })
      stream1.on('end', () => {
        t.error(err, 'no error on replicate')
        t.ok(feed2.length, 'feed has replicated')
        t.end()
      })
    })
  })

  function init (isInitiator, authKeyPair, name, feed) {
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
        t.ok(protocol, 'Protocol ok')
        feed.replicate(isInitiator, { stream: protocol })
      }
    })
    return protocol
  }
})

tape('using multifeed', t => {
  const auth1 = crypto.keyPair()
  const auth2 = crypto.keyPair()

  const multi1 = multifeed(ram)
  const multi2 = multifeed(ram)

  multi1.writer('test', (err, feed1) => {
    t.error(err, 'No error on create writer')
    feed1.append(Buffer.from('boop'), (err, seq) => {
      t.error(err, 'No error on append')
      const stream1 = init(true, auth1, 'one', multi1)
      const stream2 = init(false, auth2, 'two', multi2)
      stream1.pipe(stream2).pipe(stream1)
      stream1.on('error', (err) => {
        console.log(err)
      })
      stream1.on('end', () => {
        t.error(err, 'no error on replicate')
        multi2.feeds()[0].get(0, (err, data) => {
          t.error(err, 'no error on get')
          t.equals(data.toString(), 'boop', 'data has replicated')
          t.end()
        })
      })
    })
  })

  function init (isInitiator, authKeyPair, name, multifeed) {
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
        t.ok(protocol, 'Protocol ok')
        // multifeed.replicate() will not take a stream as an option
        // so this doesn't work
        multifeed.replicate(isInitiator, { stream: protocol })
      }
    })
    return protocol
  }
})
