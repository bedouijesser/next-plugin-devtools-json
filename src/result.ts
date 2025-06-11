export interface Result<Ok, Err> {
	readonly _tag: "ok" | "err";

	/** Transforms the Ok value if present. */
	map: <NextOk>(fn: (value: Ok) => NextOk) => Result<NextOk, Err>;

	/** Chains a Result-returning function on the Ok value. */
	andThen: <NextOk, NextErr>(
		fn: (value: Ok) => Result<NextOk, NextErr>,
	) => Result<NextOk, Err | NextErr>;

	/** Returns the Ok value or throws an error. */
	unwrap: (message?: string) => Ok;

	/** Returns the Err value or throws an error. */
	unwrapErr: (message?: string) => Err;

	/** Returns the Ok value or a fallback. */
	unwrapOr: <Or>(or: Or) => Ok | Or;

	/** Executes a side-effect on the Ok value and returns the original Result. */
	tap: (fn: (value: Ok) => void) => Result<Ok, Err>;

	/** Executes a side-effect on the Err value and returns the original Result. */
	tapErr: (fn: (error: Err) => void) => Result<Ok, Err>;

	/** Type guard for Ok variant */
	isOk: () => boolean;
	/** Type guard for Err variant */
	isErr: () => boolean;
}

class OkImpl<Ok, Err> implements Result<Ok, Err> {
	readonly _tag = "ok" as const;

	constructor(readonly value: Ok) {}

	map<NextOk>(fn: (value: Ok) => NextOk): Result<NextOk, Err> {
		return new OkImpl<NextOk, Err>(fn(this.value));
	}

	andThen<NextOk, NextErr>(
		fn: (value: Ok) => Result<NextOk, NextErr>,
	): Result<NextOk, Err | NextErr> {
		return fn(this.value);
	}

	unwrap(_message?: string): Ok {
		return this.value;
	}

	unwrapErr(message?: string): Err {
		throw new Error(
			message ||
				`Called unwrapErr on an Ok value: ${JSON.stringify(this.value)}`,
		);
	}

	unwrapOr<Or>(_or: Or): Ok | Or {
		return this.value;
	}

	tap(fn: (value: Ok) => void): Result<Ok, Err> {
		fn(this.value);
		return this;
	}

	tapErr(_fn: (error: Err) => void): Result<Ok, Err> {
		return this;
	}

	isOk(): boolean {
		return true;
	}

	isErr(): boolean {
		return false;
	}
}

class ErrImpl<Ok, Err> implements Result<Ok, Err> {
	readonly _tag = "err" as const;

	constructor(readonly error: Err) {}

	map<NextOk>(_fn: (value: Ok) => NextOk): Result<NextOk, Err> {
		return new ErrImpl<NextOk, Err>(this.error);
	}

	andThen<NextOk, NextErr>(
		_fn: (value: Ok) => Result<NextOk, NextErr>,
	): Result<NextOk, Err | NextErr> {
		return new ErrImpl<NextOk, Err | NextErr>(this.error);
	}

	unwrap(message?: string): Ok {
		throw new Error(
			message || `Called unwrap on an Err value: ${JSON.stringify(this.error)}`,
		);
	}

	unwrapErr(_message?: string): Err {
		return this.error;
	}

	unwrapOr<Or>(or: Or): Ok | Or {
		return or;
	}

	tap(_fn: (value: Ok) => void): Result<Ok, Err> {
		return this;
	}

	tapErr(fn: (error: Err) => void): Result<Ok, Err> {
		fn(this.error);
		return this;
	}

	isOk(): boolean {
		return false;
	}

	isErr(): boolean {
		return true;
	}
}

/**
 * Creates an Ok Result containing the given value.
 */
export const ok = <Ok, Err = never>(value: Ok): Result<Ok, Err> => {
	return new OkImpl<Ok, Err>(value);
};

/**
 * Creates an Err Result containing the given error.
 */
export const err = <Ok = never, Err = never>(error: Err): Result<Ok, Err> => {
	return new ErrImpl<Ok, Err>(error);
};

/**
 * Converts a throwing function to a Result-returning function.
 * @param fn - The function to convert.
 * @param mapError - A function to map the error to an Err value.
 * @returns A Result-returning function.
 */
export const tryCatch = <Ok, Err = Error>(
	fn: () => Ok,
	mapError?: (error: unknown) => Err,
): Result<Ok, Err> => {
	try {
		return ok(fn());
	} catch (error) {
		return err(mapError ? mapError(error) : (error as Err));
	}
};
