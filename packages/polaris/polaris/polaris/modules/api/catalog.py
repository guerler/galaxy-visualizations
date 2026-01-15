from .galaxy import GalaxyApi


async def load_providers(config):
    providers = []

    if config.get("galaxy_root"):
        provider = await GalaxyApi(config).init()
        providers.append(provider)
    else:
        raise Exception("Missing configuration: galaxy_root.")

    return providers
