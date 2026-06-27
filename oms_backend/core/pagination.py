from rest_framework.pagination import PageNumberPagination

class StandardPageNumberPagination(PageNumberPagination):
    """
    Custom pagination class that allows clients to control page size
    via the 'page_size' query parameter.
    """
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 1000
