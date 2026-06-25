/**
 * Central logging setup for the SDK, built on LogTape.
 *
 * The SDK logs under a single root category, `"cmssdk"`, split into two
 * sub-categories so consumers can route or filter them independently:
 *
 *   - ["cmssdk", "api"]    raw HTTP request/response (from the fetch middleware)
 *   - ["cmssdk", "entity"] high-level operations (from the resource modules)
 *
 * The loggers always emit. Nothing is written anywhere until sinks are wired
 * up via {@link configureLogging} (or LogTape's own `configure`). Because
 * LogTape configuration is process-global, call it once at application start.
 */

import { configure, getConsoleSink, getLogger, type Logger, type LogLevel, type Sink } from "@logtape/logtape"
import { getFileSink } from "@logtape/file"

/** Root category for everything this SDK logs. */
export const ROOT_CATEGORY = "cmssdk"

/** api-level: raw HTTP request/response captured in the fetch middleware. */
export const apiLogger: Logger = getLogger([ROOT_CATEGORY, "api"])

/** entity-level: high-level operations emitted from the resource modules. */
export const entityLogger: Logger = getLogger([ROOT_CATEGORY, "entity"])

/** Options controlling where and at what level SDK logs are written. */
export interface LoggingOptions {
   /** Write logs to this file path. Omit to skip the file sink. */
   file?: string
   /** Mirror logs to the console as well. Default `false`. */
   console?: boolean
   /**
    * Lowest level recorded. The level encodes the kind of log, so one threshold
    * controls everything. Default `"debug"`.
    *   - `"trace"`   full Request/Response objects + URL lines + entity ops
    *   - `"debug"`   HTTP URL lines + entity ops
    *   - `"info"`    entity-level operations only
    *   - `"warning"` (or higher) warnings/errors only
    */
   level?: LogLevel
   /** Reset any previous LogTape configuration first. Default `true`. */
   reset?: boolean
}

/**
 * Configure where the SDK's logs go. Wires a file sink and/or a console sink to
 * the api- and entity-level loggers.
 *
 * This is process-global (LogTape's `configure`), so call it once at startup,
 * before creating the client, to capture the very first requests:
 *
 * @example
 * await configureLogging({ file: "cms.log", console: true })
 * const client = cmssdk()
 *
 * @param options - file path, console mirroring, and per-level thresholds
 */
export const configureLogging = async (options: LoggingOptions = {}): Promise<void> => {
   const { file, console: toConsole = false, level = "debug", reset = true } = options

   const sinks: Record<string, Sink> = {}
   const sinkIds: string[] = []
   if (file) {
      // bufferSize: 0 -> write each record straight to disk. Avoids losing the
      // tail of the log on an abrupt exit, which matters more for an SDK than
      // the throughput a write buffer would buy.
      sinks.file = getFileSink(file, { bufferSize: 0 })
      sinkIds.push("file")
   }
   if (toConsole) {
      sinks.console = getConsoleSink()
      sinkIds.push("console")
   }

   await configure({
      reset,
      sinks,
      loggers: [
         // One config on the root category; the api/entity child loggers inherit
         // both the sinks and the level threshold.
         { category: ROOT_CATEGORY, lowestLevel: level, sinks: sinkIds },
         // Surface LogTape's own warnings/errors through the same sinks, stay quiet otherwise.
         { category: ["logtape", "meta"], lowestLevel: "warning", sinks: sinkIds },
      ],
   })
}
