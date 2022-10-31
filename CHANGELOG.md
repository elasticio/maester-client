# 5.0.0 (October 31, 2022)
* (breaking change) `ObjectStorage.getOne()` now returns an object with a `data` and `headers` properties

# 4.0.3 (August 26, 2022)
* Added `x-request-id` header with information about `flow_id`, `step_id` and `incoming_message_id`
* Added parameter `msgId` for class constructors which will be used in `x-request-id` header in each request

# 4.0.2 (August 12, 2022)
* Added parameter `userAgent` for class constructors which will be passed in each request

# 4.0.1 (July 25, 2022)
* Update component-commons-library to v.3.0.0

# 4.0.0 (July 25, 2022)
* New version of library with braking changes, look for updates in [README](/README.md)

# 3.4.3 (April 8, 2022)
* Fix dependencies

# 3.4.2 (July 27, 2021)
* Update headers validation

# 3.4.1 (July 27, 2021)
* `ObjectStorage` method `getById` now supports content-types
* `ObjectStorageWrapper` method `lookupObjectById` now supports content-types
* Added additional validation for headers

# 3.4.0 (July 22, 2021)
* Added deleteMany method
* Added ability to use custom axios config
* Added ability to add/modify `query` and `meta` headers when updating an object
* Fixed a bug when 4XX, 5XX codes where not thrown as errors
* Fixed exports

# 3.2.0 (July 5, 2021)
* createObject method now supports up to 5 query headers
* Rename lookupObjectByQueryParameter method to lookupObjectsByQueryParameters
* lookupObjectsByQueryParameters method now now supports up to 5 query parameters

# 3.1.0 (July 1, 2021)
* lookupObjectByQueryParameter method now returns JSON array instead of its string representation

# 3.0.0 (June 10, 2021)
* Library interface has been refactored to comply well-known CRUD approach

# 2.0.0 (May 28, 2021)
* Initial version of the reworked library
