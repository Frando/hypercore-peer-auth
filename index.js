const hcrypto = require('hypercore-crypto')
const sodium = require('sodium-universal')

const SIGN_BYTES = sodium.crypto_sign_BYTES // 32
const PUBKEY_BYTES = sodium.crypto_sign_PUBLICKEYBYTES // 32

module.exports = function authenticatedProtocol (protocol, opts) {
  let { onprotocol, onauthenticate, authKeyPair } = opts

  // TODO: Not sure if this is considered "public".
  const noisePublicKey = protocol.state.publicKey

  const ext = protocol.registerExtension('hypercore-auth-extension', hypercoreAuthExtension)

  // First message a peer sends on the stream: A buffer that contains my auth pubkey plus
  // my noise pubkey for this connection signed with my auth pubkeys's secret key.
  const signature = hcrypto.sign(noisePublicKey, authKeyPair.secretKey)
  const message = Buffer.concat([authKeyPair.publicKey, signature])
  ext.send(message)

  function hypercoreAuthExtension (ext) {
    return {
      // First message I receive on the stream: The buffer from my peer (as above).
      onmessage (message) {
        const authKey = message.slice(0, PUBKEY_BYTES)
        const signature = message.slice(PUBKEY_BYTES, PUBKEY_BYTES + SIGN_BYTES)

        // First of all: Verify if the signature matches (proof that the other end
        // knows the secret key for the auth key).
        var ok = hcrypto.verify(protocol.remotePublicKey, signature, authKey)
        if (!ok) return protocol.destroy(new Error('Bad signature on auth key'))

        // Now call the onauthenticate hook that lets the application allow or deny
        // this auth key.
        onauthenticate(authKey, (err, isAuthenticated) => {
          if (err) return protocol.destroy(err)
          if (!isAuthenticated) return protocol.destroy(new Error('Auth key denied'))
          // Only if both the signature are valid, and the onauthenticate handler returned true,
          // call the onprotocol handler (which ususally then would start replicating cores)
          onprotocol(protocol)
        })
      }
    }
  }
}
