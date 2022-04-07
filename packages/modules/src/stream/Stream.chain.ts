/**
 * @packageDocumentation
 * @module Stream
 */
import { Option, Struct, Vec, u8 } from '@polkadot/types'
import type {
  IStream,
  IStreamDetails,
  IPublicIdentity,
  SubmittableExtrinsic,
} from '@cord.network/api-types'
import { DecoderUtils, Identifier } from '@cord.network/utils'
import type { AccountId, Hash } from '@polkadot/types/interfaces'
import { ConfigService } from '@cord.network/config'
import { ChainApiConnection } from '@cord.network/network'
import { StreamDetails } from './Stream.js'
import { SCHEMA_PREFIX, STREAM_PREFIX } from '@cord.network/api-types'
// import { stringToU8a } from '@polkadot/util'

const log = ConfigService.LoggingFactory.getLogger('Mark')

/**
 * Generate the extrinsic to store the provided [[IStream]].
 *
 * @param stream The stream to anchor on the chain.
 * @returns The [[SubmittableExtrinsic]] for the `create` call.
 */
export async function create(stream: IStream): Promise<SubmittableExtrinsic> {
  const blockchain = await ChainApiConnection.getConnectionOrConnect()
  const linkId = stream.linkId
    ? Identifier.getIdentifierKey(stream.linkId, STREAM_PREFIX)
    : null

  const tx: SubmittableExtrinsic = blockchain.api.tx.stream.create(
    stream.creator,
    stream.streamHash,
    stream.holder,
    Identifier.getIdentifierKey(stream.schemaId, SCHEMA_PREFIX),
    linkId,
    stream.signature
  )
  return tx
}

/**
 * Generate the extrinsic to update the provided [[IStream]].
 *
 * @param stream The stream to update on the chain.
 * @returns The [[SubmittableExtrinsic]] for the `create` call.
 */
export async function update(stream: IStream): Promise<SubmittableExtrinsic> {
  const blockchain = await ChainApiConnection.getConnectionOrConnect()
  const tx: SubmittableExtrinsic = blockchain.api.tx.stream.update(
    Identifier.getIdentifierKey(stream.streamId, STREAM_PREFIX),
    stream.streamHash,
    stream.signature
  )
  return tx
}

/**
 * Generate the extrinsic to set the status of a given stream. The submitter can be the owner of the stream or an authorized delegator of the schema.
 *
 * @param streamId The stream Is.
 * @param creator The submitter
 * @param status The stream status
 * @returns The [[SubmittableExtrinsic]] for the `set_status` call.
 */
export async function setStatus(
  streamId: string,
  status: boolean,
  txHash: string,
  txSignature: string
): Promise<SubmittableExtrinsic> {
  const blockchain = await ChainApiConnection.getConnectionOrConnect()
  log.debug(() => `Revoking stream with ID ${streamId}`)
  const tx: SubmittableExtrinsic = blockchain.api.tx.stream.status(
    Identifier.getIdentifierKey(streamId, STREAM_PREFIX),
    status,
    txHash,
    txSignature
  )
  return tx
}

export interface AnchoredStreamDetails extends Struct {
  readonly streamHash: Hash
  readonly controller: AccountId
  readonly holder: Option<AccountId>
  readonly schema: Option<Hash>
  readonly link: Option<Vec<u8>>
  readonly revoked: boolean
}

function decodeStream(
  encodedStream: Option<AnchoredStreamDetails>,
  streamId: string
): StreamDetails | null {
  DecoderUtils.assertCodecIsType(encodedStream, [
    'Option<PalletStreamStreamsStreamDetails>',
  ])
  if (encodedStream.isSome) {
    const anchoredStream = encodedStream.unwrap()
    const stream: IStreamDetails = {
      streamId: streamId,
      // streamId: DecoderUtils.hexToString(anchoredStream.streamId.toString()),
      streamHash: anchoredStream.streamHash.toString(),
      controller: anchoredStream.controller.toString(),
      holder: anchoredStream.holder.toString() || null,
      schemaId:
        DecoderUtils.hexToString(anchoredStream.schema.toString()) || null,
      linkId: DecoderUtils.hexToString(anchoredStream.link.toString()) || null,
      revoked: anchoredStream.revoked.valueOf(),
    }
    return StreamDetails.fromStreamDetails(stream)
  }
  return null
}

async function queryRaw(
  streamId: string
): Promise<Option<AnchoredStreamDetails>> {
  const blockchain = await ChainApiConnection.getConnectionOrConnect()
  const result = await blockchain.api.query.stream.streams<
    Option<AnchoredStreamDetails>
  >(streamId)
  return result
}

/**
 * Query a stream from the chain given the stream Id.
 *
 * @param streamId The Id of the stream anchored.
 * @returns Either the retrieved [[StreamDetails]] or null.
 */
export async function query(streamId: string): Promise<StreamDetails | null> {
  const stream_Id = Identifier.getIdentifierKey(streamId, STREAM_PREFIX)
  const encoded = await queryRaw(stream_Id)
  return decodeStream(encoded, stream_Id)
}

/**
 * @param id
 * @internal
 */
export async function getOwner(
  streamId: string
): Promise<IPublicIdentity['address'] | null> {
  const stream_Id = Identifier.getIdentifierKey(streamId, STREAM_PREFIX)

  const encoded = await queryRaw(stream_Id)
  const queriedStreamAccount = decodeStream(encoded, stream_Id)
  return queriedStreamAccount!.controller
}
