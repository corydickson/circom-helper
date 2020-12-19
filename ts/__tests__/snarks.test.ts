jest.setTimeout(90000)
const Koa = require('koa')
import axios from 'axios'
import * as path from 'path'
import * as fs from 'fs'
import * as childProcess from 'child_process'
import * as JsonRpc from '../server/jsonRpc'
import * as errors from '../server/errors'
const ff = require('ffjavascript')
const stringifyBigInts = ff.utils.stringifyBigInts
import { run } from '../'

const PORT = 9000
const HOST = 'http://localhost:' + PORT

const OPTS = {
    headers: {
        'Content-Type': 'application/json',
    }
}

const post = (id: JsonRpc.Id, method: string, params: any) => {
    return axios.post(
        HOST,
        {
            jsonrpc: '2.0',
            id,
            method,
            params,
        },
        OPTS,
    )
}

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

let server
const cmd = `node ./build/index.js -c ./config.example.json -b ./compiled/ -t ./temp/ -p 9000 -nc`
const rootDir = path.join(
    path.resolve(__dirname),
    '..',
    '..',
)

const circuitDirs = JSON.parse(
    fs.readFileSync(
        path.join(rootDir, 'config.example.json'),
    ).toString(),
).circuitDirs

const circomPath = path.join(rootDir, 'node_modules/circom/cli.js')

describe('Witness generation', () => {
    beforeAll(async () => {
        server = await run(
            circomPath,
            circuitDirs,
            path.join(rootDir, 'compiled'),
            path.join(rootDir, 'temp'),
            9000,
            true,
            false,
        )
    })

    test('the gen_witness method should return a valid witness', async () => {
        const circuit = 'poseidon'
        const inputs = stringifyBigInts({
            left: BigInt(1),
            right: BigInt(2),
            expectedHash: BigInt('17117985411748610629288516079940078114952304104811071254131751175361957805920'),
        })

        const resp = await post(1, 'gen_witness', { circuit, inputs })

        expect(resp.status).toEqual(200)

        const witness = resp.data.result.witness

        // Get the signal index
        const resp2 = await post(
            2,
            'get_signal_index',
            { circuit, name: 'main.out' },
        )

        expect(resp2.status).toEqual(200)

        const index = resp2.data.result.index

        const expectedOut = witness[index].toString()
        expect(expectedOut).toEqual('17117985411748610629288516079940078114952304104811071254131751175361957805920')
    })

    test('the gen_witness method should return an error if the inputs are wrong', async () => {
        const circuit = 'poseidon'
        const inputs = stringifyBigInts({
            left: BigInt(1),
            right: BigInt(2),
            expectedHash: BigInt(1234), // incorrect hash value
        })

        const resp = await post(1, 'gen_witness', { circuit, inputs })

        expect(resp.status).toEqual(200)

        const error = resp.data.error

        expect(resp.data.error).toBeTruthy()
    })

    afterAll(async () => {
        await server.close()
    })
})
